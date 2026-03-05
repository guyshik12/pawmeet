import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TouchableOpacity, Image, Alert, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
  requestLocationPermission, getCurrentLocation,
  upsertLocation, fetchNearbyUsers, NearbyUser,
} from '../../services/locationService';
import { distanceKm, formatDistance } from '../../utils/distanceCalc';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

type NearbyWithDistance = NearbyUser & { distance: number };

export default function DiscoverScreen() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Get location on mount
  useEffect(() => {
    (async () => {
      const granted = await requestLocationPermission();
      if (!granted) {
        setLocationError('Location permission denied. Enable it in Settings to discover nearby dogs.');
        return;
      }
      try {
        const loc = await getCurrentLocation();
        if (loc && user) {
          setMyLocation(loc);
          await upsertLocation(user.id, loc.lat, loc.lng);
          queryClient.invalidateQueries({ queryKey: ['nearby'] });
        }
      } catch (e: any) {
        setLocationError(e.message);
      }
    })();
  }, [user]);

  const { data: nearby = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['nearby', user?.id],
    queryFn: () => fetchNearbyUsers(user!.id),
    enabled: !!user && !!myLocation,
  });

  const sorted: NearbyWithDistance[] = myLocation
    ? nearby
        .map((u) => ({ ...u, distance: distanceKm(myLocation.lat, myLocation.lng, u.lat, u.lng) }))
        .sort((a, b) => a.distance - b.distance)
    : [];

  if (locationError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorEmoji}>📍</Text>
        <Text style={styles.errorTitle}>Location needed</Text>
        <Text style={styles.errorSubtitle}>{locationError}</Text>
      </View>
    );
  }

  if (isLoading || !myLocation) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Finding nearby dogs…</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={sorted}
      keyExtractor={(item) => item.owner_id}
      contentContainerStyle={sorted.length === 0 ? styles.emptyContainer : styles.list}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      ListHeaderComponent={
        <Text style={styles.header}>
          {sorted.length > 0 ? `${sorted.length} dog${sorted.length !== 1 ? 's' : ''} nearby` : ''}
        </Text>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🐾</Text>
          <Text style={styles.emptyTitle}>No dogs nearby yet</Text>
          <Text style={styles.emptySubtitle}>Be the first! Tell your friends to join PawMeet.</Text>
        </View>
      }
      renderItem={({ item }) => <NearbyCard item={item} />}
    />
  );
}

function NearbyCard({ item }: { item: NearbyWithDistance }) {
  const firstDog = item.dogs[0];

  return (
    <View style={styles.card}>
      {/* Dog photo */}
      {firstDog?.photo_url ? (
        <Image source={{ uri: firstDog.photo_url }} style={styles.dogPhoto} />
      ) : (
        <View style={styles.dogPhotoPlaceholder}>
          <Text style={{ fontSize: 28 }}>🐶</Text>
        </View>
      )}

      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.dogName}>{firstDog?.name ?? '?'}</Text>
          <Text style={styles.distance}>{formatDistance(item.distance)}</Text>
        </View>

        {firstDog?.breed ? <Text style={styles.dogMeta}>{firstDog.breed}</Text> : null}
        {firstDog?.age_years ? <Text style={styles.dogMeta}>{firstDog.age_years} yrs</Text> : null}

        {item.dogs.length > 1 && (
          <Text style={styles.moreDogs}>+{item.dogs.length - 1} more dog{item.dogs.length - 1 !== 1 ? 's' : ''}</Text>
        )}

        <Text style={styles.ownerName}>Owner: {item.profile.name}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md },
  emptyContainer: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, backgroundColor: colors.background },
  loadingText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  errorEmoji: { fontSize: 48, marginBottom: spacing.md },
  errorTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  errorSubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  header: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.sm, fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  emptyEmoji: { fontSize: 56, marginBottom: spacing.md },
  emptyTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  emptySubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    padding: spacing.md, marginBottom: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  dogPhoto: { width: 72, height: 72, borderRadius: 36, marginRight: spacing.md },
  dogPhotoPlaceholder: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.border,
    justifyContent: 'center', alignItems: 'center', marginRight: spacing.md,
  },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dogName: { ...typography.h3, color: colors.text },
  distance: { ...typography.bodySmall, color: colors.primary, fontWeight: '700' },
  dogMeta: { ...typography.bodySmall, color: colors.textSecondary },
  moreDogs: { ...typography.caption, color: colors.primary, marginTop: 2 },
  ownerName: { ...typography.caption, color: colors.textLight, marginTop: spacing.xs },
});
