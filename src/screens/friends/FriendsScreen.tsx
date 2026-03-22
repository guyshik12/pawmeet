import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, View, Text, FlatList, StyleSheet, ActivityIndicator,
  TouchableOpacity, TouchableWithoutFeedback, Image, RefreshControl, ScrollView, TextInput,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CommonActions } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { useDogStore } from '../../store/dogStore';
import { useUnreadStore } from '../../store/unreadStore';
import { getFriends, getUnreadCountsPerFriendship } from '../../services/friendService';
import { sendMessage } from '../../services/chatService';
import { supabase } from '../../lib/supabase';
import { setOpenFriendsChat } from '../../services/activeChatRef';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import Toast from '../../components/ui/Toast';
import { useToast } from '../../hooks/useToast';
import SegmentedControl from '../../components/SegmentedControl';
import PackCard from '../../components/PackCard';
import { getPacks, PackWithMembers, joinPack, createJoinRequest } from '../../services/packService';
import { searchAll, SearchResults, SearchPackResult } from '../../services/searchService';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults>({ dogs: [], owners: [], breeds: [], packs: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchBarHeight = useRef(new Animated.Value(0)).current;

  function openSearch() {
    setSearchActive(true);
    Animated.spring(searchBarHeight, {
      toValue: 1,
      useNativeDriver: false,
      damping: 18,
      stiffness: 160,
    }).start();
    navigation.setOptions({ headerRight: undefined });
  }

  function closeSearch() {
    setSearchActive(false);
    setSearchQuery('');
    setSearchResults({ dogs: [], owners: [], breeds: [], packs: [] });
    setSearched(false);
    Animated.spring(searchBarHeight, {
      toValue: 0,
      useNativeDriver: false,
      damping: 18,
      stiffness: 160,
    }).start();
    if (activeTab === 1) {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity onPress={() => navigation.navigate('CreatePack')} style={{ marginRight: spacing.sm }}>
            <Text style={{ fontSize: 24, color: colors.primary }}>+</Text>
          </TouchableOpacity>
        ),
      });
    }
  }

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (searchQuery.length < 2) {
      setSearchResults({ dogs: [], owners: [], breeds: [], packs: [] });
      setSearched(false);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const r = await searchAll(searchQuery, userId);
        setSearchResults(r);
        setSearched(true);
      } catch {
        setSearchResults({ dogs: [], owners: [], breeds: [], packs: [] });
        setSearched(true);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchQuery, userId]);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerBackTitle: activeTab === 1 ? 'Packs' : 'Friends',
      headerLeft: activeTab === 1 ? () => (
        <TouchableOpacity onPress={() => navigation.navigate('CreatePack')} style={{ marginLeft: spacing.sm }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ fontSize: 24, color: colors.primary }}>+</Text>
        </TouchableOpacity>
      ) : undefined,
      headerRight: () => (
        <TouchableOpacity onPress={openSearch} style={{ marginRight: spacing.sm }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ fontSize: 20 }}>🔍</Text>
        </TouchableOpacity>
      ),
    });
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

  const { data: lastMessagesData = { texts: {}, times: {} } } = useQuery({
    queryKey: ['last_messages', user?.id, myDogIds.join()],
    queryFn: async () => {
      const ids = friends.map((f) => f.id);
      if (!ids.length) return { texts: {} as Record<string, string>, times: {} as Record<string, string> };
      const { data } = await supabase
        .from('messages')
        .select('friendship_id, content, sender_id, created_at')
        .in('friendship_id', ids)
        .order('created_at', { ascending: false })
        .limit(100);
      const texts: Record<string, string> = {};
      const times: Record<string, string> = {};
      for (const msg of data ?? []) {
        if (!texts[msg.friendship_id]) {
          texts[msg.friendship_id] = msg.sender_id === userId ? `You: ${msg.content}` : (msg.content ?? '');
          times[msg.friendship_id] = msg.created_at;
        }
      }
      return { texts, times };
    },
    enabled: !!user && friends.length > 0,
    refetchInterval: 30000,
  });
  const lastMessages = lastMessagesData.texts;
  const lastMessageTimes = lastMessagesData.times;

  const { data: packs = [] } = useQuery({
    queryKey: ['packs', activeDog?.id],
    queryFn: () => getPacks(activeDog!.id),
    enabled: !!user && !!activeDog,
  });

  // Pack last messages: { packId: "DogName: message" } + timestamps
  const { data: packLastMessagesData = { texts: {}, times: {} } } = useQuery({
    queryKey: ['pack_last_messages', activeDog?.id],
    queryFn: async () => {
      const packIds = packs.map((p) => p.id);
      if (!packIds.length) return { texts: {} as Record<string, string>, times: {} as Record<string, string> };
      const { data } = await supabase
        .from('messages')
        .select('pack_id, sender_id, sender_dog_id, content, type, created_at')
        .in('pack_id', packIds)
        .eq('type', 'message')
        .order('created_at', { ascending: false })
        .limit(100);
      const texts: Record<string, string> = {};
      const times: Record<string, string> = {};
      for (const msg of (data ?? []) as any[]) {
        if (!texts[msg.pack_id]) {
          const pack = packs.find((p) => p.id === msg.pack_id);
          const member = pack?.members.find((m) => m.dogId === msg.sender_dog_id);
          const dogName = msg.sender_id === userId ? 'You' : (member?.dogName ?? 'Someone');
          texts[msg.pack_id] = `${dogName}: ${msg.content}`;
          times[msg.pack_id] = msg.created_at;
        }
      }
      return { texts, times };
    },
    enabled: !!user && packs.length > 0,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  const packLastMessages = packLastMessagesData.texts;
  const packLastMessageTimes = packLastMessagesData.times;

  // Pack unread counts: { packId: number } — uses per-pack last_read from AsyncStorage
  const { data: packUnreadCounts = {} } = useQuery({
    queryKey: ['pack_unread_counts', activeDog?.id, userId],
    queryFn: async () => {
      const packIds = packs.map((p) => p.id);
      if (!packIds.length) return {} as Record<string, number>;

      // Load last-read timestamps from local storage
      const keys = packIds.map((id) => `pack_last_read_${id}`);
      const stored = await AsyncStorage.multiGet(keys);
      const lastReadMap: Record<string, string> = {};
      for (const [key, value] of stored) {
        const packId = key.replace('pack_last_read_', '');
        lastReadMap[packId] = value ?? '1970-01-01';
      }

      const fallback = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('messages')
        .select('pack_id, created_at')
        .in('pack_id', packIds)
        .neq('sender_id', userId)
        .eq('type', 'message')
        .limit(500);

      const counts: Record<string, number> = {};
      for (const msg of (data ?? []) as any[]) {
        const lastRead = lastReadMap[msg.pack_id] ?? fallback;
        if (msg.created_at > lastRead) {
          counts[msg.pack_id] = (counts[msg.pack_id] ?? 0) + 1;
        }
      }
      return counts;
    },
    enabled: !!user && packs.length > 0,
    refetchInterval: 30000,
  });

  const setUnreadCount = useUnreadStore((s) => s.setCount);
  useEffect(() => {
    const friendChatsWithUnread = Object.values(unreadCounts).filter((c) => c > 0).length;
    const packChatsWithUnread = Object.values(packUnreadCounts).filter((c) => c > 0).length;
    setUnreadCount(friendChatsWithUnread + packChatsWithUnread);
  }, [unreadCounts, packUnreadCounts]);

  const sortedFriends = useMemo(() =>
    [...friends].sort((a, b) => {
      const timeA = lastMessageTimes[a.id] ?? '1970-01-01';
      const timeB = lastMessageTimes[b.id] ?? '1970-01-01';
      return timeB.localeCompare(timeA);
    }), [friends, lastMessageTimes]);

  const sortedPacks = useMemo(() =>
    [...packs].sort((a, b) => {
      const timeA = packLastMessageTimes[a.id] ?? '1970-01-01';
      const timeB = packLastMessageTimes[b.id] ?? '1970-01-01';
      return timeB.localeCompare(timeA);
    }), [packs, packLastMessageTimes]);

  const woofMutation = useMutation({
    mutationFn: ({ friendshipId }: { friendshipId: string }) =>
      sendMessage(friendshipId, user!.id, '🐾 Quick Woof! Want to meet up?'),
    onSuccess: () => showToast('Woof sent! 🐾', 'success'),
    onError: () => showToast('Could not send woof. Try again.', 'error'),
  });

  // Refresh pack data when screen comes into focus (e.g. navigating back from chat)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      queryClient.invalidateQueries({ queryKey: ['pack_last_messages'] });
      queryClient.invalidateQueries({ queryKey: ['pack_unread_counts'] });
    });
    return unsubscribe;
  }, [navigation]);

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
        queryClient.invalidateQueries({ queryKey: ['pack_last_messages'] });
        queryClient.invalidateQueries({ queryKey: ['pack_unread_counts'] });
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
      <Animated.View style={[styles.searchBarWrap, {
        maxHeight: searchBarHeight.interpolate({ inputRange: [0, 1], outputRange: [0, 56] }),
        opacity: searchBarHeight,
        overflow: 'hidden',
      }]}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search dogs, owners, breeds, packs..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchLoading && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 4 }} />}
          <TouchableOpacity onPress={closeSearch}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
      {searchActive ? (
        <SearchResultsList
          results={searchResults}
          searched={searched}
          query={searchQuery}
          userId={userId}
          activeDog={activeDog}
          navigation={navigation}
        />
      ) : (
        <>
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
                  data={sortedPacks}
                  keyExtractor={(p) => p.id}
                  contentContainerStyle={styles.list}
                  renderItem={({ item }) => (
                    <PackCard
                      packName={item.name}
                      packPhoto={item.photo_url}
                      memberDogPhotos={item.members.slice(0, 3).map((m) => m.dogPhoto).filter(Boolean) as string[]}
                      memberCount={item.members.length}
                      lastMessage={packLastMessages[item.id] ?? null}
                      lastMessageTime={packLastMessageTimes[item.id] ?? null}
                      hasLiveMember={false}
                      unreadCount={packUnreadCounts[item.id] ?? 0}
                      packType={item.type}
                      onPress={() => navigation.navigate('PackChat', { packId: item.id, packName: item.name, memberCount: item.members.length })}
                    />
                  )}
                />
              )}
            </View>
          )}
        </>
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
  searchBarWrap: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceHigh,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  searchIcon: { fontSize: 16, marginRight: 6 },
  searchInput: { flex: 1, ...typography.body, color: colors.text, paddingVertical: 0 },
  cancelText: { ...typography.body, color: colors.primary, fontWeight: '600', marginLeft: spacing.sm },
});

const SHEET_HEIGHT = 260;

function SearchResultsList({
  results, searched, query, userId, activeDog, navigation,
}: {
  results: SearchResults;
  searched: boolean;
  query: string;
  userId: string;
  activeDog: any;
  navigation: any;
}) {
  const [joinedPackIds, setJoinedPackIds] = useState<Set<string>>(new Set());
  const [requestedPackIds, setRequestedPackIds] = useState<Set<string>>(new Set());
  const [previewPack, setPreviewPack] = useState<SearchPackResult | null>(null);
  const sheetAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  function openPackPreview(pack: SearchPackResult) {
    setPreviewPack(pack);
    Animated.spring(sheetAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 160,
    }).start();
  }

  function closePackPreview() {
    Animated.spring(sheetAnim, {
      toValue: SHEET_HEIGHT,
      useNativeDriver: true,
      damping: 18,
      stiffness: 160,
    }).start(() => setPreviewPack(null));
  }

  const hasResults = results.dogs.length > 0 || results.owners.length > 0 ||
    results.breeds.length > 0 || results.packs.length > 0;

  async function handleJoin(pack: SearchPackResult) {
    try {
      await joinPack(pack.packId, userId, activeDog?.id ?? null);
      setJoinedPackIds((prev) => new Set([...prev, pack.packId]));
      navigation.navigate('PackChat', {
        packId: pack.packId,
        packName: pack.packName,
        memberCount: pack.memberCount + 1,
      });
    } catch (e) {
      console.error('[SearchResultsList] joinPack error:', e);
    }
  }

  async function handleRequest(packId: string) {
    try {
      await createJoinRequest(packId, userId, activeDog?.id ?? null);
      setRequestedPackIds((prev) => new Set([...prev, packId]));
    } catch (e) {
      console.error('[SearchResultsList] createJoinRequest error:', e);
    }
  }

  return (
    <>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {searched && !hasResults ? (
        <Text style={searchStyles.emptyText}>No results for "{query}"</Text>
      ) : null}

      {results.packs.length > 0 && (
        <View style={searchStyles.section}>
          <Text style={searchStyles.sectionHeader}>Packs</Text>
          {results.packs.map((pack) => (
            <TouchableOpacity
              key={pack.packId}
              style={searchStyles.resultRow}
              activeOpacity={0.7}
              onPress={() => openPackPreview(pack)}
            >
              <Text style={{ fontSize: 20, marginRight: spacing.sm }}>
                {pack.packType === 'public' ? '🌍' : '🔓'}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={searchStyles.resultName}>{pack.packName}</Text>
                <Text style={searchStyles.resultMeta}>
                  {pack.memberCount} {pack.memberCount === 1 ? 'member' : 'members'} ·{' '}
                  {pack.packType === 'public' ? 'Public' : 'Semi-public'}
                </Text>
              </View>
              {pack.packType === 'public' ? (
                <TouchableOpacity
                  style={searchStyles.actionBtn}
                  onPress={() => handleJoin(pack)}
                  disabled={joinedPackIds.has(pack.packId)}
                >
                  <Text style={searchStyles.actionBtnText}>
                    {joinedPackIds.has(pack.packId) ? 'Joined ✓' : 'Join'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[searchStyles.actionBtn, searchStyles.actionBtnOutline]}
                  onPress={() => handleRequest(pack.packId)}
                  disabled={requestedPackIds.has(pack.packId)}
                >
                  <Text style={[searchStyles.actionBtnText, searchStyles.actionBtnOutlineText]}>
                    {requestedPackIds.has(pack.packId) ? 'Requested ✓' : 'Request'}
                  </Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {results.dogs.length > 0 && (
        <View style={searchStyles.section}>
          <Text style={searchStyles.sectionHeader}>Dogs</Text>
          {results.dogs.map((dog) => (
            <View key={dog.dogId} style={searchStyles.resultRow}>
              <View style={searchStyles.avatarSmall}>
                {dog.dogPhoto
                  ? <Image source={{ uri: dog.dogPhoto }} style={searchStyles.avatarImg} />
                  : <Text style={{ fontSize: 20 }}>🐶</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={searchStyles.resultName}>{dog.dogName}</Text>
                {dog.dogBreed ? <Text style={searchStyles.resultMeta}>{dog.dogBreed}</Text> : null}
              </View>
              <Text style={searchStyles.resultMeta}>{dog.ownerName}</Text>
            </View>
          ))}
        </View>
      )}

      {results.owners.length > 0 && (
        <View style={searchStyles.section}>
          <Text style={searchStyles.sectionHeader}>Owners</Text>
          {results.owners.map((owner) => (
            <View key={owner.ownerId} style={searchStyles.resultRow}>
              <View style={searchStyles.avatarSmall}>
                {owner.ownerPhoto
                  ? <Image source={{ uri: owner.ownerPhoto }} style={searchStyles.avatarImg} />
                  : <Text style={{ fontSize: 20 }}>👤</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={searchStyles.resultName}>{owner.ownerName}</Text>
                {owner.dogs.length > 0 && (
                  <Text style={searchStyles.resultMeta}>
                    {owner.dogs.map((d) => d.name).join(', ')}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {results.breeds.length > 0 && (
        <View style={searchStyles.section}>
          <Text style={searchStyles.sectionHeader}>Breeds</Text>
          {results.breeds.map((breed) => (
            <View key={breed.breed} style={searchStyles.resultRow}>
              <View style={searchStyles.avatarSmall}>
                <Text style={{ fontSize: 20 }}>🐕</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={searchStyles.resultName}>{breed.breed}</Text>
                <Text style={searchStyles.resultMeta}>{breed.count} dogs</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>

    {previewPack && (
      <TouchableWithoutFeedback onPress={closePackPreview}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>
    )}
    <Animated.View
      style={[searchStyles.sheet, { transform: [{ translateY: sheetAnim }] }]}
      pointerEvents={previewPack ? 'auto' : 'none'}
    >
      {previewPack && (
        <View style={searchStyles.sheetInner}>
          <TouchableOpacity style={searchStyles.sheetClose} onPress={closePackPreview}>
            <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>✕</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 40, marginBottom: spacing.sm }}>
            {previewPack.packType === 'public' ? '🌍' : '🔓'}
          </Text>
          <Text style={[searchStyles.resultName, { fontSize: 20, marginBottom: 4 }]}>
            {previewPack.packName}
          </Text>
          <Text style={[searchStyles.resultMeta, { marginBottom: spacing.md }]}>
            {previewPack.memberCount} {previewPack.memberCount === 1 ? 'member' : 'members'} ·{' '}
            {previewPack.packType === 'public' ? 'Public' : 'Semi-public'}
          </Text>
          {previewPack.packType === 'public' ? (
            <TouchableOpacity
              style={[searchStyles.actionBtn, { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }]}
              onPress={() => { closePackPreview(); handleJoin(previewPack); }}
              disabled={joinedPackIds.has(previewPack.packId)}
            >
              <Text style={searchStyles.actionBtnText}>
                {joinedPackIds.has(previewPack.packId) ? 'Joined ✓' : 'Join Pack'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[searchStyles.actionBtn, searchStyles.actionBtnOutline, { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }]}
              onPress={() => { closePackPreview(); handleRequest(previewPack.packId); }}
              disabled={requestedPackIds.has(previewPack.packId)}
            >
              <Text style={[searchStyles.actionBtnText, searchStyles.actionBtnOutlineText]}>
                {requestedPackIds.has(previewPack.packId) ? 'Request Sent ✓' : 'Request to Join'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </Animated.View>
    </>
  );
}

const searchStyles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  sectionHeader: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHigh,
  },
  resultName: { ...typography.body, fontWeight: '700', color: colors.text },
  resultMeta: { ...typography.bodySmall, color: colors.textSecondary },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xxl },
  avatarSmall: {
    width: 40, height: 40, borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceHigh, justifyContent: 'center',
    alignItems: 'center', marginRight: spacing.sm, overflow: 'hidden',
  },
  avatarImg: { width: 40, height: 40 },
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  actionBtnText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  actionBtnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  actionBtnOutlineText: { color: colors.primary },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  sheetInner: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
  sheetClose: {
    position: 'absolute', top: spacing.md, right: spacing.md,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center', alignItems: 'center',
  },
});
