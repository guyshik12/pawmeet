import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  Image,
  SafeAreaView,
  Alert,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useDogStore } from '../../store/dogStore';
import { joinPack, createJoinRequest, getPackMembersWithRoles, PackMemberWithRole } from '../../services/packService';
import { supabase } from '../../lib/supabase';
import { CommonActions } from '@react-navigation/native';
import {
  getNeighborhoodPacks,
  getTrendingBreeds,
  getNewPaws,
  NeighborhoodPack,
  TrendingBreed,
  NewPawsDog,
} from '../../services/hubService';

// ─── Midnight Park theme ─────────────────────────────────────────────────────
const hub = {
  bg: '#121212',
  surface: '#1E1E1E',
  border: '#2A2A2A',
  amber: '#FFB347',
  amberDark: '#FF8C00',
  amberGlow: 'rgba(255,179,71,0.35)',
  amberBg: '#FFB34722',
  text: '#EEEEEE',
  textSecondary: '#888888',
  textMuted: '#555555',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffH < 1) return 'Just now';
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function AvatarStack({ photos }: { photos: string[] }) {
  const visible = photos.slice(0, 3);
  return (
    <View style={styles.avatarStack}>
      {visible.map((uri, i) => (
        <Image
          key={i}
          source={{ uri }}
          style={[styles.stackAvatar, { left: i * 16 }]}
        />
      ))}
      {visible.length === 0 && (
        <View style={[styles.stackAvatar, styles.stackAvatarPlaceholder]}>
          <Text style={styles.stackAvatarPlaceholderText}>?</Text>
        </View>
      )}
    </View>
  );
}

function PackCard({
  pack,
  onPress,
}: {
  pack: NeighborhoodPack;
  onPress: () => void;
}) {
  const isActive = pack.activeMemberCount > 0;
  return (
    <TouchableOpacity style={styles.packCard} onPress={onPress} activeOpacity={0.8}>
      <AvatarStack photos={pack.memberPhotos} />
      <Text style={styles.packCardName} numberOfLines={1}>
        {pack.name}
      </Text>
      <Text style={[styles.packCardActive, { color: isActive ? hub.amber : hub.textMuted }]}>
        {isActive ? `${pack.activeMemberCount} active now` : 'No one active'}
      </Text>
      <Text style={styles.packCardMeta}>
        {pack.type === 'public' ? 'Public' : 'Semi-public'} · {pack.memberCount} members
      </Text>
    </TouchableOpacity>
  );
}

function BreedCircle({ breed, isTop }: { breed: TrendingBreed; isTop: boolean }) {
  return (
    <View style={styles.breedItem}>
      <View
        style={[
          styles.breedCircle,
          { borderColor: isTop ? hub.amber : hub.border },
        ]}
      >
        <Text style={styles.breedEmoji}>🐾</Text>
      </View>
      <Text style={styles.breedName} numberOfLines={1}>
        {breed.breed}
      </Text>
      <Text style={[styles.breedCount, { color: isTop ? hub.amber : hub.textMuted }]}>
        {breed.count} nearby
      </Text>
    </View>
  );
}

function NewPawCard({ dog }: { dog: NewPawsDog }) {
  return (
    <View style={styles.newPawCard}>
      {dog.photo_url ? (
        <Image source={{ uri: dog.photo_url }} style={styles.newPawPhoto} />
      ) : (
        <View style={[styles.newPawPhoto, styles.newPawPhotoPlaceholder]}>
          <Text style={styles.newPawPlaceholderText}>🐶</Text>
        </View>
      )}
      <View style={styles.newPawInfo}>
        <Text style={styles.newPawName}>{dog.name}</Text>
        <Text style={styles.newPawMeta}>
          {[dog.breed, dog.energy_level].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Text style={styles.newPawTime}>{timeAgo(dog.created_at)}</Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

const FILTER_PILLS = [
  { key: 'live', label: '🟡 Live Now' },
  { key: 'puppy', label: '🐾 Puppy Club' },
  { key: 'energy', label: '⚡ High Energy' },
  { key: 'breed', label: '🧬 Same Breed' },
];

export default function DiscoveryHubScreen({ navigation }: { navigation: any }) {
  const user = useAuthStore((s) => s.user);
  const currentDog = useDogStore((s) => s.currentDog());
  const userId = user?.id ?? '';

  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [previewPack, setPreviewPack] = useState<NeighborhoodPack | null>(null);
  const [previewMembers, setPreviewMembers] = useState<PackMemberWithRole[]>([]);
  const packSheetAnim = useRef(new Animated.Value(360)).current;

  const toggleFilter = (key: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // ─── Queries ───────────────────────────────────────────────────────────────

  // My pack memberships — to know which packs I can enter
  const { data: myPackIds = new Set<string>() } = useQuery({
    queryKey: ['my_pack_ids', currentDog?.id],
    queryFn: async () => {
      if (!currentDog?.id) return new Set<string>();
      const { data } = await supabase
        .from('pack_members')
        .select('pack_id')
        .eq('dog_id', currentDog.id);
      return new Set((data ?? []).map((m: any) => m.pack_id));
    },
    enabled: !!currentDog?.id,
  });

  const packsQuery = useQuery({
    queryKey: ['hub_packs'],
    queryFn: () => getNeighborhoodPacks(userId, currentDog?.id),
    enabled: !!userId,
  });
  const breedsQuery = useQuery({
    queryKey: ['hub_breeds'],
    queryFn: () => getTrendingBreeds(userId),
    enabled: !!userId,
  });
  const newPawsQuery = useQuery({
    queryKey: ['hub_new_paws'],
    queryFn: () => getNewPaws(userId),
    enabled: !!userId,
  });

  // ─── Filtered data ─────────────────────────────────────────────────────────
  async function openPackPreview(pack: NeighborhoodPack) {
    console.log('[Hub] Pack tapped:', pack.name);
    setPreviewPack(pack);
    setPreviewMembers([]);
    Animated.spring(packSheetAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 160,
    }).start();
    try {
      const members = await getPackMembersWithRoles(pack.id);
      setPreviewMembers(members.slice(0, 5));
    } catch {}
  }

  function closePackPreview() {
    Animated.spring(packSheetAnim, {
      toValue: 360,
      useNativeDriver: true,
      damping: 18,
      stiffness: 160,
    }).start(() => {
      setPreviewPack(null);
      setPreviewMembers([]);
    });
  }

  function goToPackChat(id: string, name: string, count: number) {
    navigation.dispatch(
      CommonActions.navigate('FriendsStack', {
        screen: 'PackChat',
        params: { packId: id, packName: name, memberCount: count },
      })
    );
  }

  async function handlePackAction(pack: NeighborhoodPack) {
    closePackPreview();
    if (myPackIds.has(pack.id)) {
      goToPackChat(pack.id, pack.name, pack.memberCount);
    } else if (pack.type === 'public') {
      try {
        await joinPack(pack.id, userId, currentDog?.id ?? null);
        goToPackChat(pack.id, pack.name, pack.memberCount + 1);
      } catch (e) {
        Alert.alert('Error', 'Could not join pack');
      }
    } else {
      try {
        await createJoinRequest(pack.id, userId, currentDog?.id ?? null);
        Alert.alert('Request Sent', `Your request to join ${pack.name} has been sent to the Pack Leaders.`);
      } catch (e) {
        Alert.alert('Already Requested', 'You already sent a request to this pack.');
      }
    }
  }

  const filteredPacks = useMemo(() => {
    const packs = packsQuery.data ?? [];
    if (activeFilters.has('live')) {
      return packs.filter((p) => p.activeMemberCount > 0);
    }
    return packs;
  }, [packsQuery.data, activeFilters]);

  const filteredNewPaws = useMemo(() => {
    const dogs = newPawsQuery.data ?? [];
    return dogs.filter((dog) => {
      if (activeFilters.has('puppy')) {
        const isPuppy =
          (dog.age_years !== null && dog.age_years < 1) ||
          dog.energy_level === 'Puppy';
        if (!isPuppy) return false;
      }
      if (activeFilters.has('energy')) {
        const isHighEnergy =
          dog.energy_level === 'High Energy' || dog.energy_level === 'Puppy';
        if (!isHighEnergy) return false;
      }
      if (activeFilters.has('breed') && currentDog?.breed) {
        if (dog.breed !== currentDog.breed) return false;
      }
      return true;
    });
  }, [newPawsQuery.data, activeFilters, currentDog]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerBrand}>✦ Sniffs</Text>
        <Text style={styles.headerTitle}>Discovery Hub</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Search Bar ── */}
        <TouchableOpacity
          style={styles.searchBar}
          activeOpacity={0.8}
          onPress={() => Alert.alert('Coming soon', 'Search is coming in the next update!')}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Search dogs, packs, breeds...</Text>
        </TouchableOpacity>

        {/* ── Action Pills ── */}
        <View style={styles.actionRow}>
          {/* Quick Match */}
          <TouchableOpacity
            style={styles.quickMatchWrapper}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('QuickMatch')}
          >
            <LinearGradient
              colors={[hub.amber, hub.amberDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.quickMatchPill}
            >
              <Text style={styles.quickMatchText}>♥ Quick Match</Text>
            </LinearGradient>
          </TouchableOpacity>

        </View>

        {/* ── Filter Pills ── */}
        <View style={styles.filterRow}>
          {FILTER_PILLS.map((pill) => {
            const isActive = activeFilters.has(pill.key);
            return (
              <TouchableOpacity
                key={pill.key}
                onPress={() => toggleFilter(pill.key)}
                activeOpacity={0.8}
                style={[
                  styles.filterPill,
                  isActive ? styles.filterPillActive : styles.filterPillInactive,
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: isActive ? hub.amber : hub.textSecondary },
                  ]}
                >
                  {pill.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Neighborhood Highlights ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>NEIGHBORHOOD HIGHLIGHTS</Text>
          <TouchableOpacity onPress={() => navigation.navigate('OpenPacks')}>
            <Text style={styles.seeAll}>See all →</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        >
          {filteredPacks.length === 0 ? (
            <Text style={styles.emptyText}>
              {packsQuery.isLoading ? 'Loading...' : 'No packs found'}
            </Text>
          ) : (
            filteredPacks.map((item) => (
              <PackCard key={item.id} pack={item} onPress={() => openPackPreview(item)} />
            ))
          )}
        </ScrollView>

        {/* ── Trending Breeds ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>TRENDING BREEDS</Text>
        </View>

        <FlatList
          data={breedsQuery.data ?? []}
          keyExtractor={(item) => item.breed}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          renderItem={({ item, index }) => (
            <BreedCircle breed={item} isTop={index === 0} />
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {breedsQuery.isLoading ? 'Loading...' : 'No breeds found'}
            </Text>
          }
        />

        {/* ── New Paws ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>NEW PAWS</Text>
          <Text style={styles.sectionSubtitle}>Last 48h</Text>
        </View>

        {(filteredNewPaws.length > 0 ? filteredNewPaws : []).map((dog) => (
          <NewPawCard key={dog.id} dog={dog} />
        ))}
        {filteredNewPaws.length === 0 && (
          <Text style={styles.emptyText}>
            {newPawsQuery.isLoading ? 'Loading...' : 'No new paws in the last 48h'}
          </Text>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Pack Preview Bottom Sheet */}
      {previewPack && (
        <TouchableWithoutFeedback onPress={closePackPreview}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      )}
      <Animated.View
        style={[styles.packSheet, { transform: [{ translateY: packSheetAnim }] }]}
        pointerEvents={previewPack ? 'auto' : 'none'}
      >
        {previewPack && (
          <View style={styles.packSheetInner}>
            <TouchableOpacity style={styles.packSheetClose} onPress={closePackPreview}>
              <Text style={{ color: hub.textSecondary, fontWeight: '600' }}>✕</Text>
            </TouchableOpacity>

            {/* Pack photo + name */}
            {previewPack.photo_url ? (
              <Image source={{ uri: previewPack.photo_url }} style={styles.packSheetPhoto} />
            ) : (
              <View style={[styles.packSheetPhoto, styles.packSheetPhotoPlaceholder]}>
                <Text style={{ fontSize: 36 }}>🐾</Text>
              </View>
            )}
            <Text style={styles.packSheetName}>{previewPack.name}</Text>
            <Text style={styles.packSheetMeta}>
              {previewPack.type === 'public' ? '🌍 Public' : '🔓 Semi-public'} · {previewPack.memberCount} members
              {previewPack.activeMemberCount > 0 ? ` · ${previewPack.activeMemberCount} active` : ''}
            </Text>

            {/* Members/Leaders */}
            {previewMembers.length > 0 && (
              <View style={styles.packSheetMembers}>
                {previewMembers.map((m) => (
                  <View key={m.dogId ?? m.userId} style={styles.packSheetMember}>
                    {m.dogPhoto ? (
                      <Image source={{ uri: m.dogPhoto }} style={styles.packSheetMemberPhoto} />
                    ) : (
                      <View style={[styles.packSheetMemberPhoto, styles.packSheetMemberPhotoPlaceholder]}>
                        <Text style={{ fontSize: 14 }}>🐶</Text>
                      </View>
                    )}
                    <Text style={styles.packSheetMemberName} numberOfLines={1}>{m.dogName}</Text>
                    {m.role === 'leader' && <Text style={styles.packSheetLeaderBadge}>🐕</Text>}
                  </View>
                ))}
              </View>
            )}

            {/* Action button */}
            <TouchableOpacity
              style={styles.packSheetAction}
              onPress={() => handlePackAction(previewPack)}
              activeOpacity={0.8}
            >
              <Text style={styles.packSheetActionText}>
                {myPackIds.has(previewPack.id) ? 'Open Chat' : previewPack.type === 'public' ? 'Join Pack' : 'Request to Join'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: hub.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: hub.bg,
  },
  headerBrand: {
    color: hub.amber,
    fontSize: 18,
    fontWeight: '700',
  },
  headerTitle: {
    color: hub.textSecondary,
    fontSize: 12,
  },

  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: hub.surface,
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchPlaceholder: {
    color: hub.textMuted,
    fontSize: 14,
  },

  // Action Pills
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 14,
    gap: 10,
  },
  quickMatchWrapper: {
    flex: 1,
    shadowColor: hub.amber,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  quickMatchPill: {
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  quickMatchText: {
    color: '#1A1A1A',
    fontSize: 15,
    fontWeight: '700',
  },
  openPacksPill: {
    flex: 1,
    backgroundColor: hub.surface,
    borderWidth: 1,
    borderColor: hub.border,
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  openPacksText: {
    color: hub.text,
    fontSize: 15,
    fontWeight: '500',
  },

  // Filter Pills
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 20,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillActive: {
    backgroundColor: hub.amberBg,
    borderColor: hub.amber,
  },
  filterPillInactive: {
    backgroundColor: hub.surface,
    borderColor: hub.border,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    color: hub.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  sectionSubtitle: {
    color: hub.textMuted,
    fontSize: 11,
  },
  seeAll: {
    color: hub.amber,
    fontSize: 12,
    fontWeight: '500',
  },

  // Horizontal list
  horizontalList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 10,
  },

  // Pack Card
  packCard: {
    width: 160,
    backgroundColor: hub.surface,
    borderWidth: 1,
    borderColor: hub.border,
    borderRadius: 16,
    padding: 12,
  },
  avatarStack: {
    height: 34,
    marginBottom: 8,
    position: 'relative',
  },
  stackAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: hub.surface,
    position: 'absolute',
    top: 0,
  },
  stackAvatarPlaceholder: {
    backgroundColor: hub.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackAvatarPlaceholderText: {
    color: hub.textMuted,
    fontSize: 12,
  },
  packCardName: {
    color: hub.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  packCardActive: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  packCardMeta: {
    color: hub.textMuted,
    fontSize: 10,
  },

  // Breed Circle
  breedItem: {
    alignItems: 'center',
    width: 72,
  },
  breedCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    backgroundColor: hub.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  breedEmoji: {
    fontSize: 22,
  },
  breedName: {
    color: hub.text,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  breedCount: {
    fontSize: 9,
    textAlign: 'center',
  },

  // New Paw Card
  newPawCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: hub.surface,
    borderWidth: 1,
    borderColor: hub.border,
    borderRadius: 12,
    padding: 12,
  },
  newPawPhoto: {
    width: 40,
    height: 40,
    borderRadius: 12,
    marginRight: 12,
  },
  newPawPhotoPlaceholder: {
    backgroundColor: hub.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newPawPlaceholderText: {
    fontSize: 20,
  },
  newPawInfo: {
    flex: 1,
  },
  newPawName: {
    color: hub.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
  },
  newPawMeta: {
    color: hub.textSecondary,
    fontSize: 11,
  },
  newPawTime: {
    color: hub.textMuted,
    fontSize: 9,
  },

  // Misc
  emptyText: {
    color: hub.textMuted,
    fontSize: 13,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  bottomSpacer: {
    height: 16,
  },
  // Pack Preview Sheet
  packSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 360,
    backgroundColor: hub.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: hub.border,
  },
  packSheetInner: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    paddingTop: 28,
  },
  packSheetClose: {
    position: 'absolute',
    top: 12,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: hub.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  packSheetPhoto: {
    width: 72,
    height: 72,
    borderRadius: 20,
    marginBottom: 10,
  },
  packSheetPhotoPlaceholder: {
    backgroundColor: hub.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  packSheetName: {
    fontSize: 20,
    fontWeight: '700',
    color: hub.text,
    marginBottom: 4,
  },
  packSheetMeta: {
    fontSize: 12,
    color: hub.textSecondary,
    marginBottom: 16,
  },
  packSheetMembers: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 20,
  },
  packSheetMember: {
    alignItems: 'center',
    width: 52,
  },
  packSheetMemberPhoto: {
    width: 44,
    height: 44,
    borderRadius: 14,
    marginBottom: 4,
  },
  packSheetMemberPhotoPlaceholder: {
    backgroundColor: hub.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  packSheetMemberName: {
    fontSize: 10,
    color: hub.textSecondary,
    textAlign: 'center',
  },
  packSheetLeaderBadge: {
    fontSize: 10,
    marginTop: 1,
  },
  packSheetAction: {
    backgroundColor: hub.amber,
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  packSheetActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: hub.bg,
  },
});
