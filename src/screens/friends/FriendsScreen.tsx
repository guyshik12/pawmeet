import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TouchableOpacity, Image, Alert, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { getIncomingRequests, getFriends, respondToRequest } from '../../services/friendService';
import { supabase } from '../../lib/supabase';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import Toast from '../../components/ui/Toast';
import { useToast } from '../../hooks/useToast';

type Tab = 'friends' | 'requests';

export default function FriendsScreen({ navigation }: { navigation: any }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const { toast, showToast, hideToast } = useToast();

  const { data: requests = [], isLoading: reqLoading, refetch: refetchReqs, isRefetching: reqRefetching } = useQuery({
    queryKey: ['friend_requests', user?.id],
    queryFn: () => getIncomingRequests(user!.id),
    enabled: !!user,
  });

  const { data: friends = [], isLoading: friendsLoading, refetch: refetchFriends, isRefetching: friendsRefetching } = useQuery({
    queryKey: ['friends', user?.id],
    queryFn: () => getFriends(user!.id),
    enabled: !!user,
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'accepted' | 'declined' }) =>
      respondToRequest(id, status),
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['friend_requests'] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      showToast(status === 'accepted' ? 'New dog friend! 🐾' : 'Request declined', status === 'accepted' ? 'success' : 'info');
    },
    onError: () => showToast('Something went wrong. Try again.', 'error'),
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('friend_requests_realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'friend_requests',
        filter: `receiver_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['friend_requests'] });
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'friendships',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['friends'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const pendingCount = requests.length;

  return (
    <View style={styles.container}>
      {/* Segment */}
      <View style={styles.segmentRow}>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'friends' && styles.segmentActive]}
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[styles.segmentText, activeTab === 'friends' && styles.segmentTextActive]}>
            Friends {friends.length > 0 ? `(${friends.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'requests' && styles.segmentActive]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.segmentText, activeTab === 'requests' && styles.segmentTextActive]}>
            Requests {pendingCount > 0 ? `(${pendingCount})` : ''}
          </Text>
          {pendingCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{pendingCount}</Text></View>}
        </TouchableOpacity>
      </View>

      {activeTab === 'friends' ? (
        friendsLoading ? (
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
                <Text style={styles.emptyTitle}>No friends yet</Text>
                <Text style={styles.emptySubtitle}>Discover nearby dogs and say hi!</Text>
              </View>
            }
            renderItem={({ item }) => {
              const dog = item.friendDogs[0];
              return (
                <View style={styles.card}>
                  {dog?.photo_url ? (
                    <Image source={{ uri: dog.photo_url }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}><Text style={{ fontSize: 26 }}>🐶</Text></View>
                  )}
                  <View style={styles.info}>
                    <Text style={styles.name}>{dog?.name ?? item.friend.name}</Text>
                    {dog?.breed ? <Text style={styles.meta}>{dog.breed}</Text> : null}
                    <Text style={styles.ownerName}>Owner: {item.friend.name}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.chatBtn}
                    onPress={() => navigation.navigate('Chat', {
                      friendshipId: item.id,
                      friendName: item.friend.name,
                      friendDogName: dog?.name ?? item.friend.name,
                    })}
                  >
                    <Text style={styles.chatBtnText}>💬</Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )
      ) : (
        reqLoading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : (
          <FlatList
            data={requests}
            keyExtractor={(r) => r.id}
            contentContainerStyle={requests.length === 0 ? styles.emptyContainer : styles.list}
            refreshControl={<RefreshControl refreshing={reqRefetching} onRefresh={refetchReqs} tintColor={colors.primary} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>💌</Text>
                <Text style={styles.emptyTitle}>No requests</Text>
                <Text style={styles.emptySubtitle}>When someone says hi to you, it'll appear here.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const dog = item.senderDogs[0];
              return (
                <View style={styles.card}>
                  {dog?.photo_url ? (
                    <Image source={{ uri: dog.photo_url }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}><Text style={{ fontSize: 26 }}>🐶</Text></View>
                  )}
                  <View style={styles.info}>
                    <Text style={styles.name}>{dog?.name ?? item.sender.name}</Text>
                    <Text style={styles.ownerName}>Owner: {item.sender.name}</Text>
                  </View>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => respondMutation.mutate({ id: item.id, status: 'accepted' })}
                    >
                      <Text style={styles.acceptText}>✓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.declineBtn}
                      onPress={() => respondMutation.mutate({ id: item.id, status: 'declined' })}
                    >
                      <Text style={styles.declineText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )
      )}
      <Toast message={toast.message} type={toast.type} visible={toast.visible} onHide={hideToast} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  segmentRow: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderBottomWidth: 1.5, borderBottomColor: colors.border,
  },
  segment: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  segmentActive: { borderBottomWidth: 3, borderBottomColor: colors.primary },
  segmentText: { ...typography.body, color: colors.textLight, fontWeight: '600' },
  segmentTextActive: { color: colors.primary, fontWeight: '800' },
  badge: {
    backgroundColor: colors.error, borderRadius: 10,
    minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  badgeText: { ...typography.caption, color: colors.text, fontWeight: '800' },
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
  avatar: { width: 60, height: 60, borderRadius: 18, marginRight: spacing.md },
  avatarPlaceholder: {
    width: 60, height: 60, borderRadius: 18, backgroundColor: colors.surfaceHigh,
    justifyContent: 'center', alignItems: 'center', marginRight: spacing.md,
  },
  info: { flex: 1 },
  name: { ...typography.h3, color: colors.text },
  meta: { ...typography.bodySmall, color: colors.textSecondary },
  ownerName: { ...typography.caption, color: colors.textLight, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  acceptBtn: {
    backgroundColor: colors.success, borderRadius: borderRadius.md,
    width: 40, height: 40, justifyContent: 'center', alignItems: 'center',
  },
  acceptText: { color: colors.background, fontWeight: '800', fontSize: 18 },
  declineBtn: {
    backgroundColor: colors.border, borderRadius: borderRadius.md,
    width: 40, height: 40, justifyContent: 'center', alignItems: 'center',
  },
  declineText: { color: colors.error, fontWeight: '800', fontSize: 18 },
  chatBtn: {
    width: 40, height: 40, borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceHigh, justifyContent: 'center', alignItems: 'center',
  },
  chatBtnText: { fontSize: 20 },
});
