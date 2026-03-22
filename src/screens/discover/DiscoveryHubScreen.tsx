import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  SafeAreaView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useDogStore } from '../../store/dogStore';
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
  const packsQuery = useQuery(['hub_packs'], () => getNeighborhoodPacks(userId), {
    enabled: !!userId,
  });
  const breedsQuery = useQuery(['hub_breeds'], () => getTrendingBreeds(userId), {
    enabled: !!userId,
  });
  const newPawsQuery = useQuery(['hub_new_paws'], () => getNewPaws(userId), {
    enabled: !!userId,
  });

  // ─── Filtered data ─────────────────────────────────────────────────────────
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

          {/* Open Packs */}
          <TouchableOpacity
            style={styles.openPacksPill}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('OpenPacks')}
          >
            <Text style={styles.openPacksText}>Open Packs →</Text>
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
          <TouchableOpacity>
            <Text style={styles.seeAll}>See all →</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={filteredPacks}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          renderItem={({ item }) => (
            <PackCard
              pack={item}
              onPress={() => {
                Alert.alert(item.name, `${item.memberCount} members · ${item.activeMemberCount} active`);
              }}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {packsQuery.isLoading ? 'Loading...' : 'No packs found'}
            </Text>
          }
        />

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
});
