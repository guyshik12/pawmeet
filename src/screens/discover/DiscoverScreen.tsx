import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TouchableOpacity, Image, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
  requestLocationPermission, getCurrentLocation,
  upsertLocation, fetchNearbyUsers, NearbyUser,
} from '../../services/locationService';
import { sendFriendRequest, getMyRequestStatuses } from '../../services/friendService';
import { distanceKm, formatDistance } from '../../utils/distanceCalc';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import Toast from '../../components/ui/Toast';
import { useToast } from '../../hooks/useToast';

type NearbyWithDistance = NearbyUser & { distance: number };

export default function DiscoverScreen() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const { toast, showToast, hideToast } = useToast();

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

  const { data: requestStatuses = {} } = useQuery({
    queryKey: ['my_requests', user?.id],
    queryFn: () => getMyRequestStatuses(user!.id),
    enabled: !!user,
  });

  const sayHiMutation = useMutation({
    mutationFn: (receiverId: string) => sendFriendRequest(user!.id, receiverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_requests'] });
      showToast('Friend request sent! 👋', 'success');
    },
    onError: () => showToast('Could not send request. Try again.', 'error'),
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
    <View style={{ flex: 1 }}>
    <FlatList
      data={sorted}
      keyExtractor={(item) => item.owner_id}
      contentContainerStyle={sorted.length === 0 ? styles.emptyContainer : styles.list}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      ListHeaderComponent={
        sorted.length > 0 ? (
          <Text style={styles.header}>{sorted.length} dog{sorted.length !== 1 ? 's' : ''} nearby</Text>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🐾</Text>
          <Text style={styles.emptyTitle}>No dogs nearby yet</Text>
          <Text style={styles.emptySubtitle}>Be the first! Tell your friends to join PawMeet.</Text>
        </View>
      }
      renderItem={({ item }) => {
        const status = requestStatuses[item.owner_id];
        return (
          <NearbyCard
            item={item}
            requestStatus={status}
            onSayHi={() => sayHiMutation.mutate(item.owner_id)}
          />
        );
      }}
    />
    <Toast message={toast.message} type={toast.type} visible={toast.visible} onHide={hideToast} />
    </View>
  );
}

function NearbyCard({
  item, requestStatus, onSayHi,
}: {
  item: NearbyWithDistance;
  requestStatus?: 'pending' | 'accepted' | 'declined';
  onSayHi: () => void;
}) {
  const firstDog = item.dogs[0];

  const renderButton = () => {
    if (requestStatus === 'accepted') {
      return <View style={styles.friendBadge}><Text style={styles.friendBadgeText}>Friends 🐾</Text></View>;
    }
    if (requestStatus === 'pending') {
      return <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>Sent 👋</Text></View>;
    }
    return (
      <TouchableOpacity style={styles.sayHiBtn} onPress={onSayHi}>
        <Text style={styles.sayHiText}>Say Hi 👋</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.card}>
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
        <View style={styles.btnRow}>{renderButton()}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, paddingTop: spacing.lg },
  emptyContainer: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, backgroundColor: colors.background },
  loadingText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  errorEmoji: { fontSize: 56, marginBottom: spacing.md },
  errorTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  errorSubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  header: { ...typography.bodySmall, color: colors.textLight, marginBottom: spacing.md, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  emptyEmoji: { fontSize: 72, marginBottom: spacing.md },
  emptyTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  emptySubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.md,
    shadowColor: colors.primaryDark, shadowOpacity: 0.1, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
    borderWidth: 1.5, borderColor: colors.border,
  },
  dogPhoto: { width: 80, height: 80, borderRadius: 24, marginRight: spacing.md },
  dogPhotoPlaceholder: {
    width: 80, height: 80, borderRadius: 24, backgroundColor: colors.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: spacing.md,
  },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dogName: { ...typography.h3, color: colors.text },
  distance: {
    ...typography.caption, color: colors.primaryDark, fontWeight: '800',
    backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm,
    paddingVertical: 2, borderRadius: borderRadius.full,
  },
  dogMeta: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 1 },
  moreDogs: { ...typography.caption, color: colors.primary, marginTop: 2, fontWeight: '600' },
  ownerName: { ...typography.caption, color: colors.textLight, marginTop: spacing.xs },
  btnRow: { marginTop: spacing.sm },
  sayHiBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.full,
    paddingVertical: 6, paddingHorizontal: spacing.md, alignSelf: 'flex-start',
    shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  sayHiText: { ...typography.bodySmall, color: colors.surface, fontWeight: '800' },
  pendingBadge: {
    backgroundColor: colors.border, borderRadius: borderRadius.full,
    paddingVertical: 6, paddingHorizontal: spacing.md, alignSelf: 'flex-start',
  },
  pendingBadgeText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  friendBadge: {
    backgroundColor: colors.secondaryLight, borderRadius: borderRadius.full,
    paddingVertical: 6, paddingHorizontal: spacing.md, alignSelf: 'flex-start',
  },
  friendBadgeText: { ...typography.bodySmall, color: colors.secondary, fontWeight: '800' },
});
