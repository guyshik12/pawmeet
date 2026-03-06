import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker } from 'react-native-maps';
import * as ExpoLocation from 'expo-location';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { useDogStore } from '../../store/dogStore';
import {
  requestLocationPermission,
  startTrip,
  updateTripLocation,
  endTrip,
  fetchActiveTripDogs,
  fetchTripLikeSender,
  TripDog,
  IncomingTripLike,
} from '../../services/locationService';
import { handleDogLike } from '../../services/friendService';
import { supabase } from '../../lib/supabase';
import DogParkIcon from '../../components/DogParkIcon';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const DOG_PARKS_URL =
  'https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer/586/query' +
  '?where=1%3D1&outFields=shem_gina,Full_Address,shaot&f=json&outSR=4326';

type DogPark = { id: string; name: string; address: string; lat: number; lng: number };

// ─── Profile bottom sheet (tap on a dog marker) ─────────────────────────────
type TripFriendship = { id: string; friendName: string; friendDogName: string; isUserA: boolean };

function TripDogSheet({
  visible,
  dog,
  onClose,
  onConnect,
  onChat,
  connecting,
  connected,
  friendship,
}: {
  visible: boolean;
  dog: TripDog | null;
  onClose: () => void;
  onConnect: () => void;
  onChat: () => void;
  connecting: boolean;
  connected: boolean;
  friendship: TripFriendship | null;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {dog && (
        <>
          <TouchableOpacity style={sheet.backdrop} activeOpacity={1} onPress={onClose} />
          <View style={sheet.container}>
            <View style={sheet.handle} />

            <View style={sheet.heroWrapper}>
              {dog.dog_photo ? (
                <Image source={{ uri: dog.dog_photo }} style={sheet.heroPhoto} />
              ) : (
                <View style={[sheet.heroPhoto, sheet.heroFallback]}>
                  <Text style={{ fontSize: 48 }}>🐶</Text>
                </View>
              )}
              <View style={sheet.ownerAvatarWrapper}>
                {dog.owner_photo ? (
                  <Image source={{ uri: dog.owner_photo }} style={sheet.ownerAvatar} />
                ) : (
                  <View style={[sheet.ownerAvatar, sheet.ownerAvatarFallback]}>
                    <Text style={{ fontSize: 14 }}>👤</Text>
                  </View>
                )}
              </View>
            </View>

            <ScrollView contentContainerStyle={sheet.body} showsVerticalScrollIndicator={false}>
              <Text style={sheet.dogName}>{dog.dog_name}</Text>
              <Text style={sheet.ownerLine}>with {dog.owner_name}</Text>
              <View style={sheet.tagsRow}>
                {dog.dog_breed && <View style={sheet.tag}><Text style={sheet.tagText}>{dog.dog_breed}</Text></View>}
                {dog.dog_age != null && <View style={sheet.tag}><Text style={sheet.tagText}>{dog.dog_age}y old</Text></View>}
                {dog.dog_energy_level && <View style={sheet.tag}><Text style={sheet.tagText}>{dog.dog_energy_level}</Text></View>}
              </View>
              {dog.dog_temperament && dog.dog_temperament.length > 0 && (
                <View style={sheet.tagsRow}>
                  {dog.dog_temperament.slice(0, 4).map((t) => (
                    <View key={t} style={sheet.tagAlt}><Text style={sheet.tagAltText}>{t}</Text></View>
                  ))}
                </View>
              )}
              {dog.dog_bio ? <Text style={sheet.bio}>{dog.dog_bio}</Text> : null}
              <View style={sheet.tripBadge}>
                <View style={sheet.tripDot} />
                <Text style={sheet.tripBadgeText}>Currently on a trip nearby</Text>
              </View>
            </ScrollView>

            <View style={sheet.actions}>
              <TouchableOpacity style={sheet.dismissBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={sheet.dismissText}>{friendship ? 'Close' : 'Maybe Later'}</Text>
              </TouchableOpacity>
              {friendship ? (
                <TouchableOpacity style={sheet.connectBtn} onPress={onChat} activeOpacity={0.8}>
                  <Text style={sheet.connectText}>Chat 💬</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[sheet.connectBtn, (connecting || connected) && sheet.connectBtnDone]}
                  onPress={onConnect}
                  disabled={connecting || connected}
                  activeOpacity={0.8}
                >
                  {connecting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={sheet.connectText}>
                      {connected ? 'Woof Sent! 🐾' : 'Connect 🐾'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </>
      )}
    </Modal>
  );
}

// ─── Incoming like popup ─────────────────────────────────────────────────────
function IncomingLikeModal({
  visible,
  like,
  onDismiss,
  onConnectBack,
  connecting,
  connected,
}: {
  visible: boolean;
  like: IncomingTripLike | null;
  onDismiss: () => void;
  onConnectBack: () => void;
  connecting: boolean;
  connected: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      {like && (
        <View style={incoming.overlay}>
          <View style={incoming.card}>
            <View style={incoming.photoWrapper}>
              {like.dog_photo ? (
                <Image source={{ uri: like.dog_photo }} style={incoming.photo} />
              ) : (
                <View style={[incoming.photo, incoming.photoFallback]}>
                  <Text style={{ fontSize: 40 }}>🐶</Text>
                </View>
              )}
              {like.owner_photo ? (
                <Image source={{ uri: like.owner_photo }} style={incoming.ownerAvatar} />
              ) : null}
            </View>

            <Text style={incoming.headline}>Someone wants to connect!</Text>
            <Text style={incoming.dogName}>{like.dog_name}</Text>
            <Text style={incoming.ownerLine}>with {like.owner_name}</Text>

            <View style={incoming.tagsRow}>
              {like.dog_breed && <View style={incoming.tag}><Text style={incoming.tagText}>{like.dog_breed}</Text></View>}
              {like.dog_age != null && <View style={incoming.tag}><Text style={incoming.tagText}>{like.dog_age}y old</Text></View>}
            </View>

            {like.dog_bio ? (
              <Text style={incoming.bio} numberOfLines={2}>{like.dog_bio}</Text>
            ) : null}

            <View style={incoming.actions}>
              <TouchableOpacity style={incoming.dismissBtn} onPress={onDismiss} activeOpacity={0.7}>
                <Text style={incoming.dismissText}>Not Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[incoming.connectBtn, (connecting || connected) && incoming.connectBtnDone]}
                onPress={onConnectBack}
                disabled={connecting || connected}
                activeOpacity={0.8}
              >
                {connecting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={incoming.connectText}>
                    {connected ? 'Woofed Back! 🐾' : 'Connect Back 🐾'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function WalksScreen() {
  const { user } = useAuthStore();
  const { currentDog, setIsOnTrip } = useDogStore();
  const dog = currentDog();
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);
  useEffect(() => { isFocusedRef.current = isFocused; }, [isFocused]);
  const navigation = useNavigation<any>();

  const [onTrip, setOnTrip] = useState(false);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [tripDogs, setTripDogs] = useState<TripDog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile sheet (tap a marker)
  const [selectedDog, setSelectedDog] = useState<TripDog | null>(null);
  const [selectedFriendship, setSelectedFriendship] = useState<TripFriendship | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  // Incoming like popup
  const [incomingLike, setIncomingLike] = useState<IncomingTripLike | null>(null);
  const [incomingConnecting, setIncomingConnecting] = useState(false);
  const [incomingConnected, setIncomingConnected] = useState(false);

  // Seen request ids so we don't re-show the same incoming popup
  const seenRequestIds = useRef<Set<string>>(new Set());
  // Dogs we already connected to — skip their reverse requests in the poll
  const connectedDogIds = useRef<Set<string>>(new Set());

  const [dogParks, setDogParks] = useState<DogPark[]>([]);

  // Fetch Tel Aviv dog parks once on mount
  useEffect(() => {
    fetch(DOG_PARKS_URL)
      .then((r) => r.json())
      .then((json) => {
        const parks: DogPark[] = (json.features ?? [])
          .filter((f: any) => f.geometry?.x && f.geometry?.y)
          .map((f: any, i: number) => ({
            id: String(f.attributes?.UniqueId ?? i),
            name: f.attributes?.shem_gina ?? 'Dog Park',
            address: f.attributes?.Full_Address ?? '',
            lat: f.geometry.y,
            lng: f.geometry.x,
          }));
        setDogParks(parks);
      })
      .catch(() => {});
  }, []);

  const watchRef = useRef<ExpoLocation.LocationSubscription | null>(null);
  const mapRef = useRef<MapView>(null);
  const locationChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const likesChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const likePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadTripDogs = useCallback(async () => {
    if (!user) return;
    try {
      const dogs = await fetchActiveTripDogs(user.id);
      setTripDogs(dogs);
    } catch {}
  }, [user?.id]);

  const handleStartTrip = async () => {
    if (!user || !dog) return;
    setLoading(true);
    setError(null);

    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        setError('Location permission is required to start a trip.');
        return;
      }

      const position = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      });
      const { latitude: lat, longitude: lng } = position.coords;

      setMyLocation({ lat, lng });
      await startTrip(user.id, dog.id, lat, lng);
      await AsyncStorage.setItem('trip_running', user.id);
      setOnTrip(true);
      setIsOnTrip(true);

      await loadTripDogs();

      // Subscribe to location updates (other dogs joining/moving)
      locationChannelRef.current = supabase
        .channel('trip_locations_' + user.id)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, () => {
          loadTripDogs();
        })
        .subscribe();

      // Poll as fallback in case realtime misses an event
      pollRef.current = setInterval(loadTripDogs, 8000);

      // Poll for incoming likes (reliable fallback for realtime)
      const currentDogId = dog.id;
      const seenIds = seenRequestIds.current;
      likePollRef.current = setInterval(async () => {
        const { data } = await supabase
          .from('friend_requests')
          .select('id, sender_dog_id, sender_id')
          .eq('receiver_dog_id', currentDogId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5);
        for (const req of data ?? []) {
          if (seenIds.has(req.id)) continue;
          // Skip reverse requests from dogs we already connected to
          if (connectedDogIds.current.has(req.sender_dog_id)) {
            seenIds.add(req.id);
            continue;
          }
          seenIds.add(req.id);
          if (!isFocusedRef.current) continue;
          const likeInfo = await fetchTripLikeSender(req.sender_dog_id, req.sender_id, req.id).catch(() => null);
          if (likeInfo) {
            setIncomingLike(likeInfo);
            setIncomingConnected(false);
            setIncomingConnecting(false);
            break;
          }
        }
      }, 4000);

      // Subscribe to ALL incoming likes, filter client-side
      likesChannelRef.current = supabase
        .channel('trip_likes_' + dog.id)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'friend_requests' },
          async (payload: any) => {
            const row = payload.new;
            if (!row) return;
            if (row.receiver_dog_id !== dog.id) return;
            if (connectedDogIds.current.has(row.sender_dog_id)) { seenRequestIds.current.add(row.id); return; }
            if (seenRequestIds.current.has(row.id)) return;
            seenRequestIds.current.add(row.id);
            if (!isFocusedRef.current) return;
            const likeInfo = await fetchTripLikeSender(row.sender_dog_id, row.sender_id, row.id).catch(() => null);
            if (likeInfo) {
              setIncomingLike(likeInfo);
              setIncomingConnected(false);
              setIncomingConnecting(false);
            }
          }
        )
        .subscribe();

      // Watch own location
      watchRef.current = await ExpoLocation.watchPositionAsync(
        { accuracy: ExpoLocation.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 5 },
        async (loc) => {
          const { latitude: newLat, longitude: newLng } = loc.coords;
          setMyLocation({ lat: newLat, lng: newLng });
          await updateTripLocation(user.id, newLat, newLng).catch(() => {});
        }
      );

      mapRef.current?.animateToRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      });
    } catch {
      setError('Could not start trip. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEndTrip = async () => {
    if (!user) return;
    AsyncStorage.removeItem('trip_running').catch(() => {});

    watchRef.current?.remove();
    watchRef.current = null;

    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (likePollRef.current) {
      clearInterval(likePollRef.current);
      likePollRef.current = null;
    }
    if (locationChannelRef.current) {
      supabase.removeChannel(locationChannelRef.current);
      locationChannelRef.current = null;
    }
    if (likesChannelRef.current) {
      supabase.removeChannel(likesChannelRef.current);
      likesChannelRef.current = null;
    }

    await endTrip(user.id).catch(() => {});
    setIsOnTrip(false);
    setOnTrip(false);
    setMyLocation(null);
    setTripDogs([]);
    setSelectedDog(null);
    setIncomingLike(null);
    seenRequestIds.current.clear();
    connectedDogIds.current.clear();
  };

  // Connect to a dog from the marker sheet
  const handleConnect = async () => {
    if (!selectedDog || !dog || !user) return;
    setConnecting(true);
    try {
      await handleDogLike(dog.id, selectedDog.dog_id, user.id, selectedDog.owner_id);
      connectedDogIds.current.add(selectedDog.dog_id);
      setSelectedDog(null);
      setSelectedFriendship(null);
    } catch {}
    setConnecting(false);
  };

  const handleChat = () => {
    if (!selectedFriendship) return;
    setSelectedDog(null);
    setSelectedFriendship(null);
    navigation.navigate('FriendsStack', {
      screen: 'Chat',
      params: {
        friendshipId: selectedFriendship.id,
        friendName: selectedFriendship.friendName,
        friendDogName: selectedFriendship.friendDogName,
        isUserA: selectedFriendship.isUserA,
      },
    });
  };

  // Connect back from the incoming like popup
  const handleConnectBack = async () => {
    if (!incomingLike || !dog || !user) return;
    setIncomingConnecting(true);
    try {
      await handleDogLike(dog.id, incomingLike.sender_dog_id, user.id, incomingLike.sender_id);
      setIncomingLike(null); // dismiss immediately so MatchModal can appear cleanly
    } catch {}
    setIncomingConnecting(false);
  };

  // Reset connect state when a different dog is selected; check if already friends
  const handleMarkerPress = async (td: TripDog) => {
    setConnected(false);
    setConnecting(false);
    setSelectedFriendship(null);
    setSelectedDog(td);
    if (!dog) return;
    const { data } = await supabase
      .from('friendships')
      .select('id, dog_a, dog_b')
      .or(`and(dog_a.eq.${dog.id},dog_b.eq.${td.dog_id}),and(dog_a.eq.${td.dog_id},dog_b.eq.${dog.id})`)
      .maybeSingle();
    if (data) {
      setSelectedFriendship({
        id: data.id,
        friendName: td.owner_name,
        friendDogName: td.dog_name,
        isUserA: data.dog_a === dog.id,
      });
    }
  };

  useEffect(() => {
    return () => {
      watchRef.current?.remove();
      if (pollRef.current) clearInterval(pollRef.current);
      if (likePollRef.current) clearInterval(likePollRef.current);
      if (locationChannelRef.current) supabase.removeChannel(locationChannelRef.current);
      if (likesChannelRef.current) supabase.removeChannel(likesChannelRef.current);
      setIsOnTrip(false);
    };
  }, []);

  // On mount: if a 'trip_running' key exists in AsyncStorage, the previous session was
  // force-closed while a trip was active — end the stale trip in the DB.
  // (React Navigation keeps this screen mounted during background, so this only
  //  runs after a real app kill, not on background→foreground resume.)
  useEffect(() => {
    if (!user) return;
    AsyncStorage.getItem('trip_running').then((savedUserId) => {
      if (savedUserId) {
        endTrip(savedUserId).catch(() => {});
        AsyncStorage.removeItem('trip_running');
        setIsOnTrip(false);
      }
    });
  }, [user?.id]);

  // ── Idle screen ──────────────────────────────────────────────────────────
  if (!onTrip) {
    return (
      <View style={styles.idle}>
        <Text style={styles.idleEmoji}>🗺️</Text>
        <Text style={styles.idleTitle}>Trip Mode</Text>
        <Text style={styles.idleSubtitle}>
          Go live with your dog's location.{'\n'}See other dogs out on trips nearby.
        </Text>
        {error && <Text style={styles.errorText}>{error}</Text>}
        <TouchableOpacity
          style={[styles.startBtn, (!dog || loading) && styles.disabledBtn]}
          onPress={handleStartTrip}
          disabled={loading || !dog}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.startBtnText}>
              {dog ? `Start Trip with ${dog.name} 🐾` : 'Select a dog first'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // ── Active trip ──────────────────────────────────────────────────────────
  return (
    <View style={styles.mapContainer}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={
          myLocation
            ? {
                latitude: myLocation.lat,
                longitude: myLocation.lng,
                latitudeDelta: 0.015,
                longitudeDelta: 0.015,
              }
            : undefined
        }
        showsUserLocation={false}
      >
        {/* My marker */}
        {myLocation && (
          <Marker
            coordinate={{ latitude: myLocation.lat, longitude: myLocation.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.myMarkerOuter}>
              <View style={styles.myMarkerInner}>
                {dog?.photo_url ? (
                  <Image source={{ uri: dog.photo_url }} style={styles.myMarkerPhoto} />
                ) : (
                  <Text style={{ fontSize: 22 }}>🐾</Text>
                )}
              </View>
            </View>
          </Marker>
        )}

        {/* Dog parks */}
        {dogParks.map((park) => (
          <Marker
            key={`park_${park.id}`}
            coordinate={{ latitude: park.lat, longitude: park.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            flat={false}
          >
            <View style={styles.parkMarker}>
              <DogParkIcon size={20} />
            </View>
          </Marker>
        ))}

        {/* Other dogs */}
        {tripDogs.map((td) => (
          <Marker
            key={td.owner_id}
            coordinate={{ latitude: td.lat, longitude: td.lng }}
            anchor={{ x: 0.5, y: 1 }}
            onPress={() => handleMarkerPress(td)}
          >
            <View style={styles.tripMarkerWrapper}>
              <View style={styles.tripMarkerBubble}>
                {td.dog_photo ? (
                  <Image source={{ uri: td.dog_photo }} style={styles.tripMarkerPhoto} />
                ) : (
                  <View style={styles.tripMarkerFallback}>
                    <Text style={{ fontSize: 18 }}>🐶</Text>
                  </View>
                )}
              </View>
              <Text style={styles.tripMarkerName} numberOfLines={1}>
                {td.dog_name}
              </Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Status bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>
          {tripDogs.length === 0
            ? 'No other dogs on a trip nearby'
            : `${tripDogs.length} dog${tripDogs.length > 1 ? 's' : ''} nearby — tap to connect`}
        </Text>
      </View>

      {/* End trip */}
      <View style={styles.endBtnWrapper}>
        <TouchableOpacity style={styles.endBtn} onPress={handleEndTrip} activeOpacity={0.8}>
          <Text style={styles.endBtnText}>End Trip</Text>
        </TouchableOpacity>
      </View>

      {/* Dog profile sheet */}
      <TripDogSheet
        visible={!!selectedDog}
        dog={selectedDog}
        onClose={() => { setSelectedDog(null); setSelectedFriendship(null); }}
        onConnect={handleConnect}
        onChat={handleChat}
        connecting={connecting}
        connected={connected}
        friendship={selectedFriendship}
      />

      {/* Incoming like popup */}
      <IncomingLikeModal
        visible={!!incomingLike}
        like={incomingLike}
        onDismiss={() => setIncomingLike(null)}
        onConnectBack={handleConnectBack}
        connecting={incomingConnecting}
        connected={incomingConnected}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  idle: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  idleEmoji: { fontSize: 64, marginBottom: spacing.lg },
  idleTitle: { ...typography.h1, color: colors.text, marginBottom: spacing.sm },
  idleSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  errorText: { ...typography.bodySmall, color: colors.error, textAlign: 'center', marginBottom: spacing.md },
  startBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: borderRadius.full,
    minWidth: 240,
    alignItems: 'center',
  },
  disabledBtn: { opacity: 0.5 },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  mapContainer: { flex: 1 },
  map: { flex: 1 },
  statusBar: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(10, 10, 10, 0.85)',
    borderRadius: borderRadius.full,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  statusText: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  endBtnWrapper: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  endBtn: {
    backgroundColor: colors.error,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: borderRadius.full,
  },
  endBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  myMarkerOuter: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  myMarkerInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceHigh,
  },
  myMarkerPhoto: { width: 50, height: 50, borderRadius: 25 },
  tripMarkerWrapper: { alignItems: 'center' },
  tripMarkerBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.primaryLight,
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripMarkerPhoto: { width: 44, height: 44, borderRadius: 22 },
  tripMarkerFallback: { justifyContent: 'center', alignItems: 'center' },
  parkMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1A4D2E',
    borderWidth: 1.5,
    borderColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripMarkerName: {
    ...typography.caption,
    color: colors.text,
    backgroundColor: 'rgba(10,10,10,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: 2,
    maxWidth: 80,
  },
});

// ─── Sheet styles ──────────────────────────────────────────────────────────
const sheet = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.72,
    paddingBottom: 32,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  heroWrapper: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heroPhoto: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  heroFallback: {
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerAvatarWrapper: {
    position: 'absolute',
    bottom: 0,
    right: '35%',
    borderWidth: 2,
    borderColor: colors.surface,
    borderRadius: 16,
  },
  ownerAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  ownerAvatarFallback: {
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  dogName: { ...typography.h2, color: colors.text, textAlign: 'center' },
  ownerLine: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.sm },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  tag: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tagText: { ...typography.caption, color: colors.textSecondary },
  tagAlt: {
    backgroundColor: 'rgba(47,128,237,0.15)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tagAltText: { ...typography.caption, color: colors.primary },
  bio: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  tripBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  tripDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  tripBadgeText: { ...typography.caption, color: colors.success, fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  dismissBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  dismissText: { ...typography.body, color: colors.textSecondary, fontWeight: '600' },
  connectBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  connectBtnDone: { backgroundColor: colors.success },
  connectText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

// ─── Incoming like modal styles ───────────────────────────────────────────────
const incoming = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.lg,
    width: '100%',
    alignItems: 'center',
  },
  photoWrapper: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.primaryLight,
  },
  photoFallback: {
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    position: 'absolute',
    bottom: 0,
    right: -4,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  headline: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  dogName: { ...typography.h2, color: colors.text, textAlign: 'center' },
  ownerLine: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.sm },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tagText: { ...typography.caption, color: colors.textSecondary },
  bio: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: spacing.xs,
  },
  dismissBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  dismissText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  connectBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  connectBtnDone: { backgroundColor: colors.success },
  connectText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
