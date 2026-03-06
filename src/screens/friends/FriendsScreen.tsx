import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TouchableOpacity, Image, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useDogStore } from '../../store/dogStore';
import { getFriends, getUnreadCountsPerFriendship } from '../../services/friendService';
import { sendMessage } from '../../services/chatService';
import { supabase } from '../../lib/supabase';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import Toast from '../../components/ui/Toast';
import { useToast } from '../../hooks/useToast';

function statusRingColor(status: 'active' | 'looking' | 'offline'): string {
  switch (status) {
    case 'active': return '#34C759';
    case 'looking': return '#FFD60A';
    default: return 'transparent';
  }
}

export default function FriendsScreen({ navigation }: { navigation: any }) {
  const { user } = useAuthStore();
  const { currentDog } = useDogStore();
  const userId = user?.id ?? '';
  const activeDog = currentDog();
  const myDogIds = activeDog ? [activeDog.id] : [];
  const queryClient = useQueryClient();
  const { toast, showToast, hideToast } = useToast();

  const { data: friends = [], isLoading: friendsLoading, refetch: refetchFriends, isRefetching: friendsRefetching } = useQuery({
    queryKey: ['friends', user?.id, myDogIds.join()],
    queryFn: () => getFriends(myDogIds),
    enabled: !!user && myDogIds.length > 0,
    refetchInterval: 10000,
  });

  const { data: unreadCounts = {} } = useQuery({
    queryKey: ['unread_counts', user?.id, myDogIds.join()],
    queryFn: () => getUnreadCountsPerFriendship(friends, userId),
    enabled: !!user && friends.length > 0,
    refetchInterval: 10000,
  });

  const woofMutation = useMutation({
    mutationFn: ({ friendshipId }: { friendshipId: string }) =>
      sendMessage(friendshipId, user!.id, '🐾 Quick Woof! Want to meet up?'),
    onSuccess: () => showToast('Woof sent! 🐾', 'success'),
    onError: () => showToast('Could not send woof. Try again.', 'error'),
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('dog_friends_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
        queryClient.invalidateQueries({ queryKey: ['friends'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['unread_counts'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return (
    <View style={styles.container}>
      {friendsLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(f) => f.id}
          contentContainerStyle={friends.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={friendsRefetching} onRefresh={refetchFriends} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🐶</Text>
              <Text style={styles.emptyTitle}>No park pals yet</Text>
              <Text style={styles.emptySubtitle}>Swipe right on dogs in Discover — when they like you back, you'll match!</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => navigation.navigate('FriendProfile', {
                dog: item.friendDog,
                ownerProfile: item.friendOwner,
                ownerId: item.friendDog.owner_id,
                friendshipId: item.id,
                isUserA: item.user_a === userId,
                friendName: item.friendOwner.name,
              })}
            >
              <View style={styles.avatarWrap}>
                {item.friendDog?.photo_url ? (
                  <Image
                    source={{ uri: item.friendDog.photo_url }}
                    style={[styles.avatar, { borderWidth: 2.5, borderColor: statusRingColor(item.friendOwner.status) }]}
                  />
                ) : (
                  <View style={[styles.avatarPlaceholder, { borderWidth: 2.5, borderColor: statusRingColor(item.friendOwner.status) }]}>
                    <Text style={{ fontSize: 26 }}>🐶</Text>
                  </View>
                )}
                {(unreadCounts[item.id] ?? 0) > 0 && (
                  <View style={styles.unreadDot} />
                )}
              </View>
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{item.friendDog?.name ?? '?'}</Text>
                  {item.friendOwner.verified && (
                    <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓</Text></View>
                  )}
                </View>
                {item.friendDog?.breed ? <Text style={styles.meta}>{item.friendDog.breed}</Text> : null}
                <Text style={styles.ownerName}>Owner: {item.friendOwner.name}</Text>
              </View>
              <View style={styles.actionBtns}>
                <TouchableOpacity
                  style={styles.woofBtn}
                  onPress={() => woofMutation.mutate({ friendshipId: item.id })}
                >
                  <Text style={styles.woofBtnText}>🐾</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.chatBtn}
                  onPress={() => navigation.navigate('Chat', {
                    friendshipId: item.id,
                    friendName: item.friendOwner.name,
                    friendDogName: item.friendDog?.name ?? item.friendOwner.name,
                    isUserA: item.user_a === userId,
                  })}
                >
                  <Text style={styles.chatBtnText}>💬</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
      <Toast message={toast.message} type={toast.type} visible={toast.visible} onHide={hideToast} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: spacing.md, paddingTop: spacing.lg },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  emptyEmoji: { fontSize: 72, marginBottom: spacing.md },
  emptyTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  emptySubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1.5, borderColor: colors.border,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  avatarWrap: { position: 'relative', marginRight: spacing.md },
  avatar: { width: 60, height: 60, borderRadius: 18 },
  avatarPlaceholder: {
    width: 60, height: 60, borderRadius: 18, backgroundColor: colors.surfaceHigh,
    justifyContent: 'center', alignItems: 'center',
  },
  unreadDot: {
    position: 'absolute', top: -3, right: -3,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: colors.error, borderWidth: 2, borderColor: colors.background,
  },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { ...typography.h3, color: colors.text },
  verifiedBadge: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  verifiedText: { fontSize: 9, color: '#fff', fontWeight: '800' },
  meta: { ...typography.bodySmall, color: colors.textSecondary },
  ownerName: { ...typography.caption, color: colors.textLight, marginTop: 2 },
  actionBtns: { flexDirection: 'row', gap: spacing.xs },
  woofBtn: {
    width: 40, height: 40, borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceHigh, justifyContent: 'center', alignItems: 'center',
  },
  woofBtnText: { fontSize: 20 },
  chatBtn: {
    width: 40, height: 40, borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceHigh, justifyContent: 'center', alignItems: 'center',
  },
  chatBtnText: { fontSize: 20 },
});
