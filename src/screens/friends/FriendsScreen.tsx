import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TouchableOpacity, Image, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CommonActions } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { useDogStore } from '../../store/dogStore';
import { getFriends, getUnreadCountsPerFriendship } from '../../services/friendService';
import { sendMessage } from '../../services/chatService';
import { supabase } from '../../lib/supabase';
import { setOpenFriendsChat } from '../../services/activeChatRef';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import Toast from '../../components/ui/Toast';
import { useToast } from '../../hooks/useToast';
import SegmentedControl from '../../components/SegmentedControl';
import PackCard from '../../components/PackCard';
import { getPacks, PackWithMembers } from '../../services/packService';

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
  const [activeTab, setActiveTab] = useState(0);

  React.useLayoutEffect(() => {
    if (activeTab === 1) {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity
            onPress={() => navigation.navigate('CreatePack')}
            style={{ marginRight: spacing.sm }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={{ fontSize: 24, color: colors.primary }}>+</Text>
          </TouchableOpacity>
        ),
      });
    } else {
      navigation.setOptions({ headerRight: undefined });
    }
  }, [activeTab]);

  // Keep a stable ref to navigation so the registered handler never captures a stale value.
  const navigationRef = React.useRef(navigation);
  navigationRef.current = navigation;

  // Register a global handler so MatchModal/banners can open a chat by always
  // resetting the FriendsStack to [Friends, Chat] — no stacked Chat screens.
  useEffect(() => {
    setOpenFriendsChat((params) => {
      navigationRef.current.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: 'Friends' },
            { name: 'Chat', params },
          ],
        })
      );
    });
    return () => setOpenFriendsChat(null);
  }, []);

  const { data: friends = [], isLoading: friendsLoading, refetch: refetchFriends, isRefetching: friendsRefetching } = useQuery({
    queryKey: ['friends', user?.id, myDogIds.join()],
    queryFn: () => getFriends(myDogIds),
    enabled: !!user && myDogIds.length > 0,
    refetchInterval: 30000,
  });

  const { data: unreadCounts = {} } = useQuery({
    queryKey: ['unread_counts', user?.id, myDogIds.join()],
    queryFn: () => getUnreadCountsPerFriendship(friends, userId),
    enabled: !!user && friends.length > 0,
    refetchInterval: 30000,
  });

  const { data: lastMessages = {} } = useQuery({
    queryKey: ['last_messages', user?.id, myDogIds.join()],
    queryFn: async () => {
      const ids = friends.map((f) => f.id);
      if (!ids.length) return {} as Record<string, string>;
      const { data } = await supabase
        .from('messages')
        .select('friendship_id, content, sender_id')
        .in('friendship_id', ids)
        .order('created_at', { ascending: false })
        .limit(100);
      const result: Record<string, string> = {};
      for (const msg of data ?? []) {
        if (!result[msg.friendship_id]) {
          result[msg.friendship_id] = msg.sender_id === userId ? `You: ${msg.content}` : (msg.content ?? '');
        }
      }
      return result;
    },
    enabled: !!user && friends.length > 0,
    refetchInterval: 30000,
  });

  const { data: packs = [] } = useQuery({
    queryKey: ['packs', user?.id],
    queryFn: () => getPacks(userId),
    enabled: !!user,
  });

  const sortedFriends = useMemo(() =>
    [...friends].sort((a, b) => {
      const unreadDiff = (unreadCounts[b.id] ?? 0) - (unreadCounts[a.id] ?? 0);
      return unreadDiff !== 0 ? unreadDiff : a.id.localeCompare(b.id);
    }), [friends, unreadCounts]);

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
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[FriendsScreen] Realtime channel error — Supabase will retry:', err);
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return (
    <View style={styles.container}>
      <SegmentedControl
        options={['Friends', 'Packs']}
        selectedIndex={activeTab}
        onChange={setActiveTab}
        style={{ margin: spacing.md, marginBottom: 0 }}
      />
      {activeTab === 0 ? (
        friendsLoading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : (
          <FlatList
            data={sortedFriends}
            keyExtractor={(f) => f.id}
            contentContainerStyle={friends.length === 0 ? styles.emptyContainer : styles.list}
            refreshControl={<RefreshControl refreshing={friendsRefetching} onRefresh={refetchFriends} tintColor={colors.primary} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🐶</Text>
                <Text style={styles.emptyTitle}>No park pals yet</Text>
                <Text style={styles.emptySubtitle}>Say hi to dogs in Discover. When they wave back, you're park pals.</Text>
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
                      <Text style={{ fontSize: 28 }}>🐶</Text>
                    </View>
                  )}
                  {(unreadCounts[item.id] ?? 0) > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>
                        {Math.min(unreadCounts[item.id] ?? 0, 9)}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.info}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{item.friendDog?.name ?? '?'}</Text>
                    {item.friendOwner.verified && (
                      <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓</Text></View>
                    )}
                    {item.friendOwner.status !== 'offline' && (
                      <View style={[styles.statusPill, { backgroundColor: statusRingColor(item.friendOwner.status) + '22' }]}>
                        <Text style={[styles.statusPillText, { color: statusRingColor(item.friendOwner.status) }]}>
                          {item.friendOwner.status === 'active' ? 'Active' : 'Looking'}
                        </Text>
                      </View>
                    )}
                  </View>
                  {item.friendDog?.breed ? <Text style={styles.meta}>{item.friendDog.breed}</Text> : null}
                  {lastMessages[item.id] ? (
                    <Text style={styles.lastMessage} numberOfLines={1}>{lastMessages[item.id]}</Text>
                  ) : null}
                  <Text style={styles.ownerName}>with {item.friendOwner.name}</Text>
                </View>
                <View style={styles.actionBtns}>
                  <TouchableOpacity
                    style={styles.woofBtn}
                    onPress={() => woofMutation.mutate({ friendshipId: item.id })}
                  >
                    <Text style={styles.woofBtnText}>Woof</Text>
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
                    <Text style={styles.chatBtnText}>Chat</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )}
          />
        )
      ) : (
        <View style={{ flex: 1 }}>
          {packs.length === 0 ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 72 }}>🐾</Text>
              <Text style={styles.emptyTitle}>No packs yet</Text>
              <Text style={styles.emptySubtitle}>Gather your park pals into a Pack for group hangouts.</Text>
              <TouchableOpacity style={styles.chatBtn} onPress={() => navigation.navigate('CreatePack')}>
                <Text style={styles.chatBtnText}>Start a Pack</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={packs}
              keyExtractor={(p) => p.id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <PackCard
                  packName={item.name}
                  memberDogPhotos={item.members.slice(0, 3).map((m) => m.dogPhoto).filter(Boolean) as string[]}
                  memberCount={item.members.length}
                  lastMessage={null}
                  hasLiveMember={false}
                  unreadCount={0}
                  packType={item.type}
                  onPress={() => navigation.navigate('PackChat', { packId: item.id, packName: item.name, memberCount: item.members.length })}
                />
              )}
            />
          )}
        </View>
      )}
      <Toast message={toast.message} type={toast.type} visible={toast.visible} onHide={hideToast} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  emptyEmoji: { fontSize: 72, marginBottom: spacing.md },
  emptyTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  emptySubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  avatarWrap: { position: 'relative', marginRight: spacing.md },
  avatar: { width: 68, height: 68, borderRadius: 20 },
  avatarPlaceholder: {
    width: 68, height: 68, borderRadius: 20, backgroundColor: colors.surfaceHigh,
    justifyContent: 'center', alignItems: 'center',
  },
  unreadBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.background,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
  },
  unreadBadgeText: { fontSize: 10, color: '#fff', fontWeight: '800' },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  verifiedBadge: {
    width: 15, height: 15, borderRadius: 8,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  verifiedText: { fontSize: 8, color: '#fff', fontWeight: '800' },
  meta: { ...typography.bodySmall, color: colors.textSecondary },
  lastMessage: { fontSize: 12, color: colors.textLight, marginTop: 1 },
  ownerName: { fontSize: 11, color: colors.textLight },
  statusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.full },
  statusPillText: { fontSize: 10, fontWeight: '700' as const },
  actionBtns: { flexDirection: 'column', gap: 6, alignItems: 'flex-end' },
  woofBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.border, backgroundColor: 'transparent',
  },
  woofBtnText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' as const },
  chatBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
  chatBtnText: { fontSize: 12, color: '#fff', fontWeight: '700' as const },
});
