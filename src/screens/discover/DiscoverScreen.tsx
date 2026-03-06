import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity,
  ActivityIndicator, ScrollView, Image, Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  runOnJS, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useDogStore } from '../../store/dogStore';
import MatchModal from '../../components/MatchModal';
import {
  requestLocationPermission, getCurrentLocation,
  upsertLocation, fetchNearbyUsers, NearbyUser, NearbyDogData,
} from '../../services/locationService';
import { handleDogLike, getMyRequestStatuses, getFriends } from '../../services/friendService';
import { distanceKm, formatDistance } from '../../utils/distanceCalc';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import Toast from '../../components/ui/Toast';
import { useToast } from '../../hooks/useToast';
import { Dog } from '../../types/database.types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;
// Hero fills the visible card area so the photo is the first thing you see
const HERO_HEIGHT = SCREEN_HEIGHT * 0.64;

// ─── Match algorithm ──────────────────────────────────────────────────────────

const ENERGY_ORDER = ['Puppy', 'High Energy', 'Medium Energy', 'Low Energy', 'Senior'];
const SIZE_ORDER = ['Toy', 'Small', 'Medium', 'Large', 'Giant'];

function computeMatch(mine: Dog, theirs: NearbyDogData): number | null {
  let score = 0;
  let maxScore = 0;
  if (mine.energy_level && theirs.energy_level) {
    maxScore += 25;
    const diff = Math.abs(ENERGY_ORDER.indexOf(mine.energy_level) - ENERGY_ORDER.indexOf(theirs.energy_level));
    score += diff === 0 ? 25 : diff === 1 ? 12 : 0;
  }
  if (mine.size && theirs.size) {
    maxScore += 20;
    const diff = Math.abs(SIZE_ORDER.indexOf(mine.size) - SIZE_ORDER.indexOf(theirs.size));
    score += diff === 0 ? 20 : diff === 1 ? 15 : diff === 2 ? 8 : 0;
  }
  if (theirs.good_with_dogs) {
    maxScore += 20;
    score += theirs.good_with_dogs === 'Yes' ? 20 : theirs.good_with_dogs === 'Depends' ? 10 : 0;
  }
  if (mine.activities?.length && theirs.activities?.length) {
    maxScore += 20;
    const shared = mine.activities.filter((a) => theirs.activities!.includes(a)).length;
    score += Math.round((shared / Math.max(mine.activities.length, theirs.activities.length)) * 20);
  }
  if (mine.temperament?.length && theirs.temperament?.length) {
    maxScore += 15;
    const shared = mine.temperament.filter((t) => theirs.temperament!.includes(t)).length;
    score += Math.round((shared / Math.max(mine.temperament.length, theirs.temperament.length)) * 15);
  }
  if (maxScore < 20) return null;
  return Math.round((score / maxScore) * 100);
}

function ownerStatusColor(status: 'active' | 'looking' | 'offline'): string {
  switch (status) {
    case 'active': return '#34C759';
    case 'looking': return '#FFD60A';
    default: return '#555555';
  }
}

function matchColor(pct: number): string {
  if (pct >= 80) return '#34C759';
  if (pct >= 60) return '#8BC34A';
  if (pct >= 40) return '#FFD60A';
  return '#FF9500';
}

// ─── Types ────────────────────────────────────────────────────────────────────

type NearbyDogCard = {
  dog: NearbyDogData;
  owner: NearbyUser;
  distance: number;
  matchPct: number | null;
};


// ─── Profile detail section (shown when scrolling down) ───────────────────────

function SpeechBubble({ question, answer }: { question: string; answer: string }) {
  return (
    <View style={styles.speechBubble}>
      <Text style={styles.speechQuestion}>{question}</Text>
      <Text style={styles.speechAnswer}>{answer}</Text>
    </View>
  );
}

function InlinePhoto({ uri }: { uri: string }) {
  return (
    <View style={styles.inlinePhotoWrap}>
      <Image source={{ uri }} style={styles.inlinePhoto} resizeMode="cover" />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.18)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
}

function OwnerCard({ owner }: { owner: NearbyUser }) {
  const p = owner.profile;
  const statusLabel =
    p.status === 'active' ? 'Active now' :
    p.status === 'looking' ? 'Looking to meet' :
    'Offline';

  return (
    <View style={styles.ownerCard}>
      <Text style={styles.sectionTitle}>Meet the Human</Text>

      {/* Top row: avatar + name/status */}
      <View style={styles.ownerCardInner}>
        <View style={styles.ownerAvatarWrap}>
          {p.photo_url ? (
            <Image source={{ uri: p.photo_url }} style={styles.ownerAvatar} resizeMode="cover" />
          ) : (
            <View style={styles.ownerAvatarPlaceholder}>
              <Text style={{ fontSize: 30 }}>👤</Text>
            </View>
          )}
          <View style={[styles.ownerStatusRing, { backgroundColor: ownerStatusColor(p.status) }]} />
        </View>
        <View style={styles.ownerMeta}>
          <View style={styles.ownerNameRow}>
            <Text style={styles.ownerNameText}>{p.name}</Text>
            {p.verified && (
              <View style={styles.ownerVerifiedBadge}>
                <Text style={styles.ownerVerifiedText}>✓</Text>
              </View>
            )}
          </View>
          <View style={styles.ownerStatusRow2}>
            <View style={[styles.statusDot, { backgroundColor: ownerStatusColor(p.status) }]} />
            <Text style={styles.ownerStatusLabel}>{statusLabel}</Text>
          </View>
        </View>
      </View>

      {/* Info pills: age, occupation, neighborhood */}
      {(p.age || p.occupation || p.neighborhood) ? (
        <View style={styles.ownerInfoPillRow}>
          {p.age ? (
            <View style={styles.ownerInfoPill}><Text style={styles.ownerInfoPillText}>🎂 {p.age}</Text></View>
          ) : null}
          {p.occupation ? (
            <View style={styles.ownerInfoPill}><Text style={styles.ownerInfoPillText}>💼 {p.occupation}</Text></View>
          ) : null}
          {p.neighborhood ? (
            <View style={styles.ownerInfoPill}><Text style={styles.ownerInfoPillText}>📍 {p.neighborhood}</Text></View>
          ) : null}
        </View>
      ) : null}

      {/* Bio */}
      {p.bio ? <Text style={styles.ownerBioText}>{p.bio}</Text> : null}

      {/* Interests */}
      {p.interests?.length ? (
        <View style={styles.ownerInterestsRow}>
          {p.interests.map((interest) => (
            <View key={interest} style={styles.ownerInterestChip}>
              <Text style={styles.ownerInterestChipText}>{interest}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ProfileDetails({ dog, owner }: { dog: NearbyDogData; owner: NearbyUser }) {
  const extraPhotos = (dog.photos ?? []).filter(Boolean);
  const prompts = (dog.prompts ?? []).filter((p) => p.question && p.answer);

  return (
    <View style={styles.details}>

      {/* ── Block 1: Bio + Details ── */}
      {dog.bio ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.bioText}>{dog.bio}</Text>
        </View>
      ) : null}

      {(dog.size || dog.training_level || dog.energy_level) ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.pillRow}>
            {dog.size ? <View style={styles.pill}><Text style={styles.pillText}>{dog.size}</Text></View> : null}
            {dog.training_level ? <View style={styles.pill}><Text style={styles.pillText}>{dog.training_level}</Text></View> : null}
            {dog.energy_level ? <View style={styles.pill}><Text style={styles.pillText}>{dog.energy_level}</Text></View> : null}
          </View>
        </View>
      ) : null}

      {/* ── Prompt 0 ── */}
      {prompts[0] ? <SpeechBubble question={prompts[0].question} answer={prompts[0].answer} /> : null}

      {/* ── Extra photo 0 ── */}
      {extraPhotos[0] ? <InlinePhoto uri={extraPhotos[0]} /> : null}

      {/* ── Block 2: Compatibility + Health ── */}
      {(dog.good_with_dogs || dog.good_with_kids) ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compatibility</Text>
          <View style={styles.compatRow}>
            {dog.good_with_dogs ? (
              <View style={styles.compatItem}>
                <Text style={styles.compatIcon}>🐾</Text>
                <Text style={styles.compatLabel}>With dogs</Text>
                <Text style={[styles.compatValue, { color: dog.good_with_dogs === 'Yes' ? '#34C759' : dog.good_with_dogs === 'No' ? colors.error : colors.textSecondary }]}>
                  {dog.good_with_dogs}
                </Text>
              </View>
            ) : null}
            {dog.good_with_kids ? (
              <View style={styles.compatItem}>
                <Text style={styles.compatIcon}>👶</Text>
                <Text style={styles.compatLabel}>With kids</Text>
                <Text style={[styles.compatValue, { color: dog.good_with_kids === 'Yes' ? '#34C759' : dog.good_with_kids === 'No' ? colors.error : colors.textSecondary }]}>
                  {dog.good_with_kids}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {(dog.vaccinated !== null || dog.neutered !== null) ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Health</Text>
          <View style={styles.pillRow}>
            {dog.vaccinated !== null ? (
              <View style={[styles.healthBadge, { borderColor: dog.vaccinated ? '#34C759' : colors.error }]}>
                <Text style={{ color: dog.vaccinated ? '#34C759' : colors.error, fontWeight: '700', fontSize: 13 }}>
                  {dog.vaccinated ? '✓' : '✕'} Vaccinated
                </Text>
              </View>
            ) : null}
            {dog.neutered !== null ? (
              <View style={[styles.healthBadge, { borderColor: dog.neutered ? '#34C759' : colors.error }]}>
                <Text style={{ color: dog.neutered ? '#34C759' : colors.error, fontWeight: '700', fontSize: 13 }}>
                  {dog.neutered ? '✓' : '✕'} Neutered
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* ── Prompt 1 ── */}
      {prompts[1] ? <SpeechBubble question={prompts[1].question} answer={prompts[1].answer} /> : null}

      {/* ── Extra photo 1 ── */}
      {extraPhotos[1] ? <InlinePhoto uri={extraPhotos[1]} /> : null}

      {/* ── Block 3: Temperament + Activities ── */}
      {dog.temperament?.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Temperament</Text>
          <View style={styles.chipRow}>
            {dog.temperament.map((t) => (
              <View key={t} style={styles.chip}><Text style={styles.chipText}>{t}</Text></View>
            ))}
          </View>
        </View>
      ) : null}

      {dog.activities?.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Favorite Activities</Text>
          <View style={styles.chipRow}>
            {dog.activities.map((a) => (
              <View key={a} style={styles.chip}><Text style={styles.chipText}>{a}</Text></View>
            ))}
          </View>
        </View>
      ) : null}

      {/* ── Prompt 2 ── */}
      {prompts[2] ? <SpeechBubble question={prompts[2].question} answer={prompts[2].answer} /> : null}

      {/* ── Owner Card ── */}
      <OwnerCard owner={owner} />

    </View>
  );
}

// ─── SwipeCard ─────────────────────────────────────────────────────────────────

function SwipeCard({
  item, isTop, onSwipeLeft, onSwipeRight,
}: {
  item: NearbyDogCard;
  isTop: boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Only activate for horizontal movement; fail if vertical comes first
  const panGesture = Gesture.Pan()
    .enabled(isTop)
    .activeOffsetX([-15, 15])
    .failOffsetY([-20, 20])
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.1;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        const toX = e.translationX > 0 ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
        const cb = e.translationX > 0 ? onSwipeRight : onSwipeLeft;
        translateX.value = withTiming(toX, { duration: 280 }, () => runOnJS(cb)());
      } else {
        translateX.value = withSpring(0, { damping: 15, stiffness: 120 });
        translateY.value = withSpring(0, { damping: 15, stiffness: 120 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: isTop
      ? [
          { translateX: translateX.value },
          { translateY: translateY.value },
          { rotate: `${interpolate(translateX.value, [-SCREEN_WIDTH / 2, SCREEN_WIDTH / 2], [-10, 10], Extrapolation.CLAMP)}deg` },
        ]
      : [{ scale: 0.95 }, { translateY: 10 }],
    zIndex: isTop ? 10 : 5,
  }));

  const likeOpacity = useAnimatedStyle(() => ({
    opacity: isTop ? interpolate(translateX.value, [20, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP) : 0,
  }));
  const passOpacity = useAnimatedStyle(() => ({
    opacity: isTop ? interpolate(translateX.value, [-SWIPE_THRESHOLD, -20], [1, 0], Extrapolation.CLAMP) : 0,
  }));

  const { dog, owner, distance, matchPct } = item;

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, cardStyle]}>
        <ScrollView
          scrollEnabled={isTop}
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {/* ── Hero (photo + overlay) ── */}
          <View style={{ height: HERO_HEIGHT }}>
            {dog.photo_url ? (
              <Image source={{ uri: dog.photo_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            ) : (
              <View style={[StyleSheet.absoluteFillObject, styles.cardPhotoPlaceholder]}>
                <Text style={{ fontSize: 80 }}>🐶</Text>
              </View>
            )}

            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
              locations={[0.35, 0.62, 1]}
              style={[StyleSheet.absoluteFillObject, styles.gradient]}
            >
              <View style={styles.heroInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.cardName}>{dog.name}</Text>
                  {dog.gender ? (
                    <View style={styles.genderBadge}>
                      <Text style={styles.genderText}>{dog.gender === 'Male' ? '♂' : '♀'}</Text>
                    </View>
                  ) : null}
                  {matchPct !== null ? (
                    <View style={[styles.matchPill, { backgroundColor: matchColor(matchPct) }]}>
                      <Text style={styles.matchPillText}>{matchPct}%</Text>
                    </View>
                  ) : null}
                </View>
                {(dog.breed || dog.age_years) ? (
                  <Text style={styles.cardBreed}>
                    {[dog.breed, dog.age_years ? `${dog.age_years} yrs` : null].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
                <View style={styles.cardTagsRow}>
                  {dog.size ? <View style={styles.cardTag}><Text style={styles.cardTagText}>{dog.size}</Text></View> : null}
                  {dog.energy_level ? <View style={styles.cardTag}><Text style={styles.cardTagText}>{dog.energy_level}</Text></View> : null}
                  {dog.good_with_dogs === 'Yes' ? <View style={styles.cardTag}><Text style={styles.cardTagText}>🐾 Good w/ dogs</Text></View> : null}
                </View>
                <View style={styles.ownerStatusRow}>
                  <View style={[styles.statusDot, { backgroundColor: ownerStatusColor(owner.profile.status) }]} />
                  <Text style={styles.cardOwner}>{owner.profile.name} · {formatDistance(distance)}</Text>
                </View>
                <View style={styles.scrollHint}>
                  <Text style={styles.scrollHintText}>↓ scroll for more</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* ── Full profile below ── */}
          <ProfileDetails dog={dog} owner={owner} />
        </ScrollView>

        {/* Swipe overlays — fixed over the card, not inside scroll */}
        <Animated.View style={[styles.overlayBadge, styles.likeOverlay, likeOpacity]} pointerEvents="none">
          <Text style={styles.likeOverlayText}>SAY HI 🐾</Text>
        </Animated.View>
        <Animated.View style={[styles.overlayBadge, styles.passOverlay, passOpacity]} pointerEvents="none">
          <Text style={styles.passOverlayText}>PASS</Text>
        </Animated.View>

      </Animated.View>
    </GestureDetector>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const { user } = useAuthStore();
  const { currentDog } = useDogStore();
  const myDog = currentDog();
  const queryClient = useQueryClient();
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [distanceFilter, setDistanceFilter] = useState(0); // km, 0 = any
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matchData, setMatchData] = useState<{ theirDogName: string; theirDogPhoto: string | null } | null>(null);
  const { setLastDiscoverMatchMs } = useDogStore();

  // Reload distance setting whenever this screen is focused
  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem('settings_distance_km').then((v) => {
      if (v !== null) setDistanceFilter(parseInt(v, 10));
    });
  }, []));
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

  const { data: nearby = [], isLoading, refetch } = useQuery({
    queryKey: ['nearby', user?.id],
    queryFn: () => fetchNearbyUsers(user!.id),
    enabled: !!user && !!myLocation,
  });

  const { data: requestStatuses = {} } = useQuery({
    queryKey: ['my_requests', user?.id, myDog?.id ?? ''],
    queryFn: () => getMyRequestStatuses(myDog ? [myDog.id] : []),
    enabled: !!user && !!myDog,
  });

  const { data: myFriends = [] } = useQuery({
    queryKey: ['friends', user?.id, myDog?.id ?? ''],
    queryFn: () => getFriends(myDog ? [myDog.id] : []),
    enabled: !!user && !!myDog,
  });
  const friendDogIds = new Set(myFriends.map((f) => f.friendDog.id));

  const sayHiMutation = useMutation({
    mutationFn: async (card: NearbyDogCard) => {
      if (!myDog || !user) throw new Error('No dog selected');
      return handleDogLike(myDog.id, card.dog.id, user.id, card.owner.owner_id);
    },
    onSuccess: ({ matched }, card) => {
      queryClient.invalidateQueries({ queryKey: ['my_requests'] });
      if (matched) {
        queryClient.invalidateQueries({ queryKey: ['friends'] });
        setLastDiscoverMatchMs(Date.now());
        setMatchData({ theirDogName: card.dog.name, theirDogPhoto: card.dog.photo_url ?? null });
      }
    },
    onError: (e: any) => showToast(e.message ?? 'Could not send like.', 'error'),
  });

  const allCards: NearbyDogCard[] = myLocation
    ? nearby.flatMap((owner) =>
        owner.dogs
          .filter((dog) => !friendDogIds.has(dog.id))
          .map((dog) => ({
            dog, owner,
            distance: distanceKm(myLocation.lat, myLocation.lng, owner.lat, owner.lng),
            matchPct: myDog ? computeMatch(myDog, dog) : null,
          }))
      )
    : [];

  const filtered = distanceFilter === 0
    ? allCards
    : allCards.filter((c) => c.distance <= distanceFilter);

  const sorted = [...filtered].sort(
    (a, b) => (b.matchPct ?? -1) - (a.matchPct ?? -1) || a.distance - b.distance
  );

  // Auto-reset index when new dogs become available (e.g. after data is cleared)
  useEffect(() => {
    if (sorted.length > 0 && currentIndex >= sorted.length) {
      setCurrentIndex(0);
    }
  }, [sorted.length]);

  const currentCard = sorted[currentIndex] ?? null;
  const nextCard = sorted[currentIndex + 1] ?? null;

  const handleSwipeRight = useCallback(() => {
    if (currentCard) {
      // Skip only if already friends (accepted) — let the RPC handle duplicate likes gracefully
      if (requestStatuses[currentCard.dog.id] !== 'accepted') {
        sayHiMutation.mutate(currentCard);
      }
    }
    setCurrentIndex((i) => i + 1);
  }, [currentCard, requestStatuses]);

  const handleSwipeLeft = useCallback(() => setCurrentIndex((i) => i + 1), []);

  if (locationError) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 48 }}>📍</Text>
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
    <View style={styles.container}>
      {/* Distance badge */}
      <View style={styles.distanceBadgeRow}>
        <View style={styles.distanceBadge}>
          <Text style={styles.distanceBadgeText}>
            {distanceFilter === 0 ? 'Any distance' : `Within ${distanceFilter} km`}
          </Text>
        </View>
      </View>

      {/* Card stack */}
      <View style={styles.stackContainer}>
        {sorted.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 72 }}>🐾</Text>
            <Text style={styles.emptyTitle}>No dogs nearby</Text>
            <Text style={styles.emptySubtitle}>Be the first! Tell your friends to join PawMeet.</Text>
          </View>
        ) : !currentCard ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 72 }}>🎉</Text>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>You've seen all nearby dogs.</Text>
            <TouchableOpacity style={styles.restartBtn} onPress={() => { setCurrentIndex(0); refetch(); }}>
              <Text style={styles.restartBtnText}>Start Over</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {nextCard && (
              <SwipeCard
                key={`next-${currentIndex}`}
                item={nextCard}
                isTop={false}
                onSwipeLeft={() => {}}
                onSwipeRight={() => {}}
              />
            )}
            <SwipeCard
              key={`top-${currentIndex}`}
              item={currentCard}
              isTop
              onSwipeLeft={handleSwipeLeft}
              onSwipeRight={handleSwipeRight}
            />
          </>
        )}
      </View>

      {/* Action buttons */}
      {currentCard && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.passBtn} onPress={handleSwipeLeft}>
            <Text style={styles.passBtnIcon}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.likeBtn} onPress={handleSwipeRight}>
            <Text style={styles.likeBtnIcon}>🐾</Text>
          </TouchableOpacity>
        </View>
      )}

      <Toast message={toast.message} type={toast.type} visible={toast.visible} onHide={hideToast} />

      <MatchModal
        visible={!!matchData}
        myDogName={myDog?.name ?? ''}
        myDogPhoto={myDog?.photo_url ?? null}
        theirDogName={matchData?.theirDogName ?? ''}
        theirDogPhoto={matchData?.theirDogPhoto ?? null}
        onClose={() => setMatchData(null)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, backgroundColor: colors.background },
  loadingText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  errorTitle: { ...typography.h2, color: colors.text, marginTop: spacing.md },
  errorSubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },

  distanceBadgeRow: { alignItems: 'center', paddingVertical: spacing.xs },
  distanceBadge: {
    paddingVertical: 4, paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  distanceBadgeText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },

  stackContainer: {
    flex: 1,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },

  card: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0F0F0F',
    borderWidth: 1,
    borderColor: '#2E2E2E',
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  cardPhotoPlaceholder: {
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },

  gradient: {
    justifyContent: 'flex-end',
  },
  heroInfo: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  cardName: { fontSize: 30, fontWeight: '800', color: '#fff' },
  genderBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2,
  },
  genderText: { fontSize: 15, color: '#fff', fontWeight: '700' },
  matchPill: {
    borderRadius: borderRadius.full, paddingHorizontal: 9, paddingVertical: 3,
  },
  matchPillText: { fontSize: 13, color: '#fff', fontWeight: '800' },
  cardBreed: { fontSize: 15, color: 'rgba(255,255,255,0.8)', marginTop: 3 },
  cardTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  cardTag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: borderRadius.full, paddingVertical: 3, paddingHorizontal: 10,
  },
  cardTagText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  cardOwner: { fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  scrollHint: { alignItems: 'center', marginTop: spacing.xs },
  scrollHintText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },

  // Profile details section
  details: {
    backgroundColor: colors.background,
    paddingTop: spacing.md,
  },
  inlinePhotoWrap: {
    width: '100%',
    height: HERO_HEIGHT,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderRadius: 24,
  },
  inlinePhoto: {
    width: '100%',
    height: '100%',
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.bodySmall,
    color: colors.textLight,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  bioText: { ...typography.body, color: colors.text, lineHeight: 22 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pill: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: borderRadius.full,
    paddingVertical: 5, paddingHorizontal: spacing.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
  pillText: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  compatRow: { flexDirection: 'row', gap: spacing.lg },
  compatItem: { alignItems: 'center', gap: 3 },
  compatIcon: { fontSize: 22 },
  compatLabel: { ...typography.caption, color: colors.textLight },
  compatValue: { ...typography.bodySmall, fontWeight: '700' },
  healthBadge: {
    borderWidth: 1.5, borderRadius: borderRadius.full,
    paddingVertical: 5, paddingHorizontal: spacing.md,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    backgroundColor: `${colors.primary}15`,
    borderRadius: borderRadius.full,
    paddingVertical: 5, paddingHorizontal: spacing.md,
    borderWidth: 1.5, borderColor: `${colors.primary}40`,
  },
  chipText: { ...typography.bodySmall, color: colors.primary, fontWeight: '600' },
  ownerNameText: { ...typography.h3, color: colors.text, fontWeight: '700' },

  ownerCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    backgroundColor: colors.surfaceHigh,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
  },
  ownerCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  ownerAvatarWrap: { position: 'relative' },
  ownerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.border,
  },
  ownerAvatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerStatusRing: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.background,
  },
  ownerMeta: { flex: 1, gap: 4 },
  ownerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ownerVerifiedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerVerifiedText: { fontSize: 10, color: '#fff', fontWeight: '800' },
  ownerStatusRow2: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ownerStatusLabel: { ...typography.bodySmall, color: colors.textSecondary },

  ownerInfoPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  ownerInfoPill: {
    backgroundColor: colors.surface, borderRadius: borderRadius.full,
    paddingVertical: 4, paddingHorizontal: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  ownerInfoPillText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  ownerBioText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md, lineHeight: 22 },
  ownerInterestsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  ownerInterestChip: {
    backgroundColor: `${colors.primary}15`, borderRadius: borderRadius.full,
    paddingVertical: 5, paddingHorizontal: spacing.md,
    borderWidth: 1.5, borderColor: `${colors.primary}40`,
  },
  ownerInterestChipText: { ...typography.bodySmall, color: colors.primary, fontWeight: '600' },

  speechBubble: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5, borderColor: colors.border,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderBottomLeftRadius: 4,
  },
  speechQuestion: {
    ...typography.caption, color: colors.primary,
    fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: spacing.xs,
  },
  speechAnswer: { ...typography.body, color: colors.text, lineHeight: 22 },

  ownerStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  // Swipe overlays
  overlayBadge: {
    position: 'absolute',
    top: spacing.xl,
    borderWidth: 3, borderRadius: borderRadius.md,
    paddingVertical: 6, paddingHorizontal: spacing.md,
  },
  likeOverlay: { right: spacing.lg, borderColor: '#34C759', transform: [{ rotate: '15deg' }] },
  likeOverlayText: { fontSize: 20, fontWeight: '900', color: '#34C759' },
  passOverlay: { left: spacing.lg, borderColor: colors.error, transform: [{ rotate: '-15deg' }] },
  passOverlayText: { fontSize: 20, fontWeight: '900', color: colors.error },

  sentBadge: {
    position: 'absolute', top: spacing.md, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: borderRadius.full,
    paddingVertical: 6, paddingHorizontal: spacing.md,
  },
  sentBadgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Action buttons
  actionRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: spacing.xl * 1.5, paddingVertical: spacing.md, paddingBottom: spacing.lg,
  },
  passBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.error,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.error, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  passBtnIcon: { fontSize: 26, color: colors.error, fontWeight: '700' },
  likeBtn: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  likeBtnSent: { backgroundColor: colors.border },
  likeBtnIcon: { fontSize: 28 },

  // Empty states
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyTitle: { ...typography.h2, color: colors.text, marginTop: spacing.md },
  emptySubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  restartBtn: {
    marginTop: spacing.lg, backgroundColor: colors.primary,
    borderRadius: borderRadius.full, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl,
  },
  restartBtnText: { ...typography.body, color: colors.background, fontWeight: '800' },
});
