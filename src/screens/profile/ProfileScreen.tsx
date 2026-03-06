import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ScrollView, Image, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, Switch,
  PanResponder,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography, borderRadius, shadow } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useDogStore } from '../../store/dogStore';
import { getDogs, updateDog, deleteDog } from '../../services/dogService';
import { pickAndUploadImage } from '../../utils/imageUpload';
import { updateStatus } from '../../services/profileService';
import { Dog } from '../../types/database.types';
import AddEditDogModal from '../dogs/AddEditDogModal';
import GlassCard from '../../components/ui/GlassCard';
import { updateProfile } from '../../services/profileService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEYS = {
  notifFriendRequests: 'settings_notif_friend_requests',
  notifMessages: 'settings_notif_messages',
  notifNearby: 'settings_notif_nearby',
  showInDiscover: 'settings_show_in_discover',
  shareLocation: 'settings_share_location',
  distanceKm: 'settings_distance_km',
};

function DistanceSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const trackRef = React.useRef<View>(null);
  const trackWidthRef = React.useRef(0);
  const trackPageXRef = React.useRef(0);

  const measureTrack = () => {
    trackRef.current?.measure((_x, _y, width, _height, pageX) => {
      trackWidthRef.current = width;
      trackPageXRef.current = pageX;
    });
  };

  const valueFromPageX = (pageX: number) => {
    const w = trackWidthRef.current;
    if (!w) return value;
    const x = Math.max(0, Math.min(pageX - trackPageXRef.current, w));
    return Math.round((x / w) * 10);
  };

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (e) => {
        // Re-measure on each touch so position is always accurate
        trackRef.current?.measure((_x, _y, width, _height, pageX) => {
          trackWidthRef.current = width;
          trackPageXRef.current = pageX;
          onChange(valueFromPageX(e.nativeEvent.pageX));
        });
      },
      onPanResponderMove: (e) => {
        onChange(valueFromPageX(e.nativeEvent.pageX));
      },
    })
  ).current;

  const pct = (value / 10) * 100;

  return (
    <View>
      <View
        ref={trackRef}
        style={sliderStyles.track}
        onLayout={measureTrack}
        {...panResponder.panHandlers}
      >
        <View style={[sliderStyles.fill, { width: `${pct}%` }]} />
        <View style={[sliderStyles.thumb, { left: `${pct}%` }]} />
      </View>
      <View style={sliderStyles.labels}>
        <Text style={sliderStyles.labelText}>0</Text>
        <Text style={sliderStyles.labelValue}>{value === 0 ? 'Any distance' : `${value} km`}</Text>
        <Text style={sliderStyles.labelText}>10 km</Text>
      </View>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  track: {
    height: 6, backgroundColor: '#2A2A2A', borderRadius: 3,
    marginVertical: spacing.md, position: 'relative', justifyContent: 'center',
  },
  fill: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: colors.primary, borderRadius: 3,
  },
  thumb: {
    position: 'absolute', width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#fff', top: -9,
    transform: [{ translateX: -12 }],
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  labels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelText: { ...typography.caption, color: colors.textLight },
  labelValue: { ...typography.bodySmall, color: colors.primary, fontWeight: '700' },
});

const OWNER_INTERESTS = [
  'Hiking', 'Running', 'Dog Training', 'Photography', 'Travel',
  'Coffee', 'Yoga', 'Gaming', 'Cooking', 'Reading',
  'Music', 'Fitness', 'Nature', 'Beach', 'Cycling',
];

type UserStatus = 'active' | 'looking' | 'offline';

const STATUS_OPTIONS: { value: UserStatus; label: string; emoji: string; color: string }[] = [
  { value: 'active', label: 'Active', emoji: '🟢', color: colors.success },
  { value: 'looking', label: 'Looking', emoji: '🟡', color: colors.warning },
  { value: 'offline', label: 'Offline', emoji: '⚫', color: '#555' },
];

type Props = {
  navigation: any;
};

function BoolBadge({ label, value }: { label: string; value: boolean | null }) {
  if (value === null) return null;
  return (
    <View style={[badgeStyles.badge, value ? badgeStyles.yes : badgeStyles.no]}>
      <Text style={badgeStyles.text}>{value ? '✓' : '✗'} {label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    paddingVertical: 3, paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full, marginRight: spacing.xs,
  },
  yes: { backgroundColor: 'rgba(52,199,89,0.15)', borderWidth: 1, borderColor: '#34C759' },
  no: { backgroundColor: 'rgba(255,59,48,0.1)', borderWidth: 1, borderColor: '#FF3B30' },
  text: { ...typography.caption, fontWeight: '700' },
});

export default function ProfileScreen({ navigation }: Props) {
  const { user, profile } = useAuthStore();
  const queryClient = useQueryClient();
  const { dogs, setDogs, currentDog, setCurrentDogId, currentDogId } = useDogStore();
  const [editingDog, setEditingDog] = useState<Dog | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<UserStatus>(
    (profile?.status as UserStatus) ?? 'offline'
  );

  // Owner profile edit state
  const [ownerModalVisible, setOwnerModalVisible] = useState(false);
  const [ownerName, setOwnerName] = useState(profile?.name ?? '');
  const [ownerBio, setOwnerBio] = useState(profile?.bio ?? '');
  const [ownerAge, setOwnerAge] = useState(profile?.age?.toString() ?? '');
  const [ownerOccupation, setOwnerOccupation] = useState(profile?.occupation ?? '');
  const [ownerNeighborhood, setOwnerNeighborhood] = useState(profile?.neighborhood ?? '');
  const [ownerInterests, setOwnerInterests] = useState<string[]>(profile?.interests ?? []);
  const [savingOwner, setSavingOwner] = useState(false);

  const { setProfile } = useAuthStore();

  const openOwnerModal = () => {
    setOwnerName(profile?.name ?? '');
    setOwnerBio(profile?.bio ?? '');
    setOwnerAge(profile?.age?.toString() ?? '');
    setOwnerOccupation(profile?.occupation ?? '');
    setOwnerNeighborhood(profile?.neighborhood ?? '');
    setOwnerInterests(profile?.interests ?? []);
    setOwnerModalVisible(true);
  };

  const handleSaveOwner = async () => {
    if (!user || !ownerName.trim()) { Alert.alert('Error', 'Name is required'); return; }
    setSavingOwner(true);
    try {
      const updated = await updateProfile(user.id, {
        name: ownerName.trim(),
        bio: ownerBio.trim() || undefined,
        age: ownerAge ? parseInt(ownerAge, 10) : null,
        occupation: ownerOccupation.trim() || null,
        neighborhood: ownerNeighborhood.trim() || null,
        interests: ownerInterests.length ? ownerInterests : null,
      });
      setProfile(updated);
      setOwnerModalVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingOwner(false);
    }
  };

  useQuery({
    queryKey: ['dogs', user?.id],
    queryFn: async () => {
      const data = await getDogs(user!.id);
      setDogs(data);
      return data;
    },
    enabled: !!user,
  });

  const dog = currentDog();

  const handlePickPhoto = async () => {
    if (!dog) return;
    setUploadingPhoto(true);
    try {
      const url = await pickAndUploadImage('dog-photos', `dog-${dog.id}`);
      if (url) {
        await updateDog(dog.id, { photo_url: url });
        queryClient.invalidateQueries({ queryKey: ['dogs'] });
      }
    } catch (e: any) {
      Alert.alert('Upload Error', e.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleStatusChange = async (status: UserStatus) => {
    setCurrentStatus(status);
    try {
      await updateStatus(user!.id, status);
    } catch (_) {
      // silent — optimistic update already done
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  // Settings state
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [notifFriendRequests, setNotifFriendRequests] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifNearby, setNotifNearby] = useState(false);
  const [showInDiscover, setShowInDiscover] = useState(true);
  const [shareLocation, setShareLocation] = useState(true);
  const [distanceKm, setDistanceKm] = useState(5);

  // Load persisted settings
  React.useEffect(() => {
    AsyncStorage.multiGet(Object.values(SETTINGS_KEYS)).then((pairs) => {
      const map = Object.fromEntries(pairs.map(([k, v]) => [k, v]));
      if (map[SETTINGS_KEYS.notifFriendRequests] !== null) setNotifFriendRequests(map[SETTINGS_KEYS.notifFriendRequests] === 'true');
      if (map[SETTINGS_KEYS.notifMessages] !== null) setNotifMessages(map[SETTINGS_KEYS.notifMessages] === 'true');
      if (map[SETTINGS_KEYS.notifNearby] !== null) setNotifNearby(map[SETTINGS_KEYS.notifNearby] === 'true');
      if (map[SETTINGS_KEYS.showInDiscover] !== null) setShowInDiscover(map[SETTINGS_KEYS.showInDiscover] === 'true');
      if (map[SETTINGS_KEYS.shareLocation] !== null) setShareLocation(map[SETTINGS_KEYS.shareLocation] === 'true');
      if (map[SETTINGS_KEYS.distanceKm] !== null) setDistanceKm(parseInt(map[SETTINGS_KEYS.distanceKm] ?? '5', 10));
    });
  }, []);

  const saveSetting = (key: string, value: boolean | number) =>
    AsyncStorage.setItem(key, String(value));

  const toggle = (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    saveSetting(key, value);
  };

  // Add gear button to header
  React.useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => setSettingsVisible(true)} style={{ marginRight: spacing.md }}>
          <Text style={{ fontSize: 22, color: colors.textSecondary }}>⚙️</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const handleChangePassword = () => {
    Alert.alert(
      'Change Password',
      `We'll send a reset link to ${user?.email}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Link',
          onPress: async () => {
            try {
              await supabase.auth.resetPasswordForEmail(user!.email!);
              Alert.alert('Sent!', 'Check your email for the reset link.');
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => supabase.auth.signOut(),
        },
      ]
    );
  };

  const handleDeleteDog = (d: Dog) => {
    Alert.alert(
      'Remove Dog',
      `Remove ${d.name} from your profile? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDog(d.id);
              queryClient.invalidateQueries({ queryKey: ['dogs'] });
              queryClient.invalidateQueries({ queryKey: ['friends'] });
              queryClient.invalidateQueries({ queryKey: ['friend_requests'] });
              queryClient.invalidateQueries({ queryKey: ['badge_count'] });
              queryClient.invalidateQueries({ queryKey: ['my_requests'] });
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  if (!dog) {
    return (
      <View style={styles.noDog}>
        <Text style={styles.noDogEmoji}>🦴</Text>
        <Text style={styles.noDogTitle}>No dog yet</Text>
        <Text style={styles.noDogSubtitle}>Add your dog to get started!</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setEditingDog(null); setModalVisible(true); }}>
          <Text style={styles.addBtnText}>+ Add My Dog</Text>
        </TouchableOpacity>
        <AddEditDogModal
          visible={modalVisible}
          dog={null}
          onClose={() => setModalVisible(false)}
          onSaved={() => { setModalVisible(false); queryClient.invalidateQueries({ queryKey: ['dogs'] }); }}
        />
      </View>
    );
  }

  const statusRingColor =
    currentStatus === 'active' ? colors.success :
    currentStatus === 'looking' ? colors.warning :
    colors.border;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 2-Dog Switcher */}
      {dogs.length > 1 && (
        <View style={styles.switcherRow}>
          {dogs.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={[styles.switcherPill, currentDogId === d.id && styles.switcherPillActive]}
              onPress={() => setCurrentDogId(d.id)}
            >
              <Text style={[styles.switcherText, currentDogId === d.id && styles.switcherTextActive]}>
                {d.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Dog Photo */}
      <TouchableOpacity style={styles.photoContainer} onPress={handlePickPhoto} disabled={uploadingPhoto}>
        {dog.photo_url ? (
          <Image source={{ uri: dog.photo_url }} style={[styles.photo, { borderColor: statusRingColor }]} />
        ) : (
          <View style={[styles.photoPlaceholder, { borderColor: statusRingColor }]}>
            <Text style={{ fontSize: 64 }}>🐶</Text>
          </View>
        )}
        {uploadingPhoto ? (
          <View style={styles.photoOverlay}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <View style={styles.cameraHint}>
            <Text style={styles.cameraHintText}>📷</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Dog Name + gender */}
      <Text style={styles.dogName}>{dog.name}</Text>
      {dog.gender ? (
        <Text style={styles.dogGender}>{dog.gender === 'Male' ? '♂ Male' : '♀ Female'}</Text>
      ) : null}

      {/* Extra photos row */}
      {(dog.photos?.length ?? 0) > 0 && (
        <View style={styles.extraPhotosRow}>
          {(dog.photos ?? []).filter(Boolean).map((uri, i) => (
            <Image key={i} source={{ uri }} style={styles.extraPhoto} />
          ))}
        </View>
      )}

      {/* Breed + Size + Training pills */}
      <View style={styles.pillsRow}>
        {dog.breed ? <Text style={styles.breedPill}>{dog.breed}</Text> : null}
        {dog.size ? <Text style={styles.infoPill}>{dog.size}</Text> : null}
        {dog.training_level ? <Text style={styles.infoPill}>{dog.training_level}</Text> : null}
      </View>

      {dog.age_years ? <Text style={styles.dogAge}>{dog.age_years} years old</Text> : null}

      {/* Compatibility row */}
      {(dog.good_with_dogs || dog.good_with_kids) ? (
        <View style={styles.compatRow}>
          {dog.good_with_dogs ? (
            <View style={styles.compatItem}>
              <Text style={styles.compatIcon}>🐾</Text>
              <Text style={styles.compatLabel}>Dogs: {dog.good_with_dogs}</Text>
            </View>
          ) : null}
          {dog.good_with_kids ? (
            <View style={styles.compatItem}>
              <Text style={styles.compatIcon}>👶</Text>
              <Text style={styles.compatLabel}>Kids: {dog.good_with_kids}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Health badges */}
      {(dog.vaccinated !== null || dog.neutered !== null) ? (
        <View style={styles.healthRow}>
          <BoolBadge label="Vaccinated" value={dog.vaccinated} />
          <BoolBadge label="Neutered" value={dog.neutered} />
        </View>
      ) : null}

      {/* Temperament chips */}
      {dog.temperament && dog.temperament.length > 0 ? (
        <View style={styles.chipsSection}>
          <Text style={styles.chipsLabel}>Temperament</Text>
          <View style={styles.chipsWrap}>
            {dog.temperament.map((t) => (
              <View key={t} style={styles.readChip}>
                <Text style={styles.readChipText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Activities chips */}
      {dog.activities && dog.activities.length > 0 ? (
        <View style={styles.chipsSection}>
          <Text style={styles.chipsLabel}>Favorite Activities</Text>
          <View style={styles.chipsWrap}>
            {dog.activities.map((a) => (
              <View key={a} style={styles.readChip}>
                <Text style={styles.readChipText}>{a}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {dog.bio ? <Text style={styles.dogBio}>{dog.bio}</Text> : null}

      {/* Icebreakers */}
      {(dog.prompts as any[] | null)?.filter((p) => p.question && p.answer).map((p, i) => (
        <View key={i} style={styles.speechBubble}>
          <Text style={styles.speechQuestion}>{p.question}</Text>
          <Text style={styles.speechAnswer}>{p.answer}</Text>
        </View>
      ))}

      {/* Edit Button */}
      <TouchableOpacity
        style={styles.editBtn}
        onPress={() => { setEditingDog(dog); setModalVisible(true); }}
      >
        <BlurView intensity={30} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: borderRadius.full }]} />
        <Text style={styles.editBtnText}>Edit Profile</Text>
      </TouchableOpacity>

      {/* Add Dog button — only when < 2 dogs */}
      {dogs.length < 2 && (
        <TouchableOpacity
          style={styles.addDogBtn}
          onPress={() => { setEditingDog(null); setModalVisible(true); }}
        >
          <Text style={styles.addDogBtnText}>+ Add Another Dog</Text>
        </TouchableOpacity>
      )}

      {/* Status Picker */}
      <View style={styles.statusRow}>
        {STATUS_OPTIONS.map((opt) => {
          const active = currentStatus === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.statusPill, active && { borderColor: opt.color, backgroundColor: `${opt.color}22` }]}
              onPress={() => handleStatusChange(opt.value)}
            >
              <Text style={styles.statusEmoji}>{opt.emoji}</Text>
              <Text style={[styles.statusLabel, active && { color: opt.color, fontWeight: '700' }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Owner Profile Card */}
      <GlassCard style={styles.accountSection}>
        <View style={styles.accountHeaderRow}>
          <Text style={styles.accountLabel}>YOUR PROFILE</Text>
          <TouchableOpacity onPress={openOwnerModal}>
            <Text style={styles.accountEditLink}>Edit</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.accountName}>{profile?.name ?? 'Dog Owner'}</Text>
        <Text style={styles.accountEmail}>{user?.email}</Text>

        {(profile?.age || profile?.occupation || profile?.neighborhood) ? (
          <View style={styles.ownerInfoRow}>
            {profile.age ? <View style={styles.ownerInfoPill}><Text style={styles.ownerInfoPillText}>🎂 {profile.age}</Text></View> : null}
            {profile.occupation ? <View style={styles.ownerInfoPill}><Text style={styles.ownerInfoPillText}>💼 {profile.occupation}</Text></View> : null}
            {profile.neighborhood ? <View style={styles.ownerInfoPill}><Text style={styles.ownerInfoPillText}>📍 {profile.neighborhood}</Text></View> : null}
          </View>
        ) : null}

        {profile?.bio ? <Text style={styles.ownerBioText}>{profile.bio}</Text> : null}

        {profile?.interests?.length ? (
          <View style={styles.ownerInterestsWrap}>
            {profile.interests.map((i) => (
              <View key={i} style={styles.ownerInterestChip}>
                <Text style={styles.ownerInterestChipText}>{i}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </GlassCard>

      {/* Owner Edit Modal */}
      <Modal visible={ownerModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOwnerModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.ownerModalHeader}>
            <TouchableOpacity onPress={() => setOwnerModalVisible(false)}>
              <Text style={styles.ownerModalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.ownerModalTitle}>Edit Your Profile</Text>
            <TouchableOpacity onPress={handleSaveOwner} disabled={savingOwner}>
              <Text style={[styles.ownerModalSave, savingOwner && { opacity: 0.5 }]}>{savingOwner ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.ownerModalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.ownerModalLabel}>Name *</Text>
            <TextInput style={styles.ownerModalInput} value={ownerName} onChangeText={setOwnerName} placeholder="Your name" placeholderTextColor={colors.textLight} />

            <Text style={styles.ownerModalLabel}>Age</Text>
            <TextInput style={styles.ownerModalInput} value={ownerAge} onChangeText={setOwnerAge} placeholder="e.g. 28" placeholderTextColor={colors.textLight} keyboardType="number-pad" />

            <Text style={styles.ownerModalLabel}>Occupation</Text>
            <TextInput style={styles.ownerModalInput} value={ownerOccupation} onChangeText={setOwnerOccupation} placeholder="e.g. Designer" placeholderTextColor={colors.textLight} />

            <Text style={styles.ownerModalLabel}>Neighborhood</Text>
            <TextInput style={styles.ownerModalInput} value={ownerNeighborhood} onChangeText={setOwnerNeighborhood} placeholder="e.g. Tel Aviv, Florentin" placeholderTextColor={colors.textLight} />

            <Text style={styles.ownerModalLabel}>About Me</Text>
            <TextInput
              style={[styles.ownerModalInput, { height: 80, textAlignVertical: 'top' }]}
              value={ownerBio} onChangeText={setOwnerBio}
              placeholder="A little about yourself…" placeholderTextColor={colors.textLight}
              multiline numberOfLines={3}
            />

            <Text style={styles.ownerModalLabel}>Interests</Text>
            <View style={styles.ownerChipWrap}>
              {OWNER_INTERESTS.map((interest) => {
                const selected = ownerInterests.includes(interest);
                return (
                  <TouchableOpacity
                    key={interest}
                    style={[styles.ownerChip, selected && styles.ownerChipSelected]}
                    onPress={() => setOwnerInterests(
                      selected ? ownerInterests.filter((i) => i !== interest) : [...ownerInterests, interest]
                    )}
                  >
                    <Text style={[styles.ownerChipText, selected && styles.ownerChipTextSelected]}>{interest}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={settingsVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSettingsVisible(false)}>
        <View style={styles.settingsModalHeader}>
          <Text style={styles.settingsModalTitle}>Settings</Text>
          <TouchableOpacity onPress={() => setSettingsVisible(false)}>
            <Text style={styles.settingsModalClose}>Done</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.settingsModalBody} contentContainerStyle={{ paddingBottom: spacing.xxl }}>

          <Text style={styles.settingsHeader}>DISCOVER</Text>
          <GlassCard style={styles.settingsCard}>
            <View style={[styles.settingsRow, { flexDirection: 'column', alignItems: 'stretch' }]}>
              <Text style={styles.settingsLabel}>Maximum Distance</Text>
              <DistanceSlider
                value={distanceKm}
                onChange={(v) => { setDistanceKm(v); saveSetting(SETTINGS_KEYS.distanceKm, v as any); }}
              />
            </View>
          </GlassCard>

          <Text style={styles.settingsHeader}>NOTIFICATIONS</Text>
          <GlassCard style={styles.settingsCard}>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>Friend Requests</Text>
              <Switch value={notifFriendRequests} onValueChange={(v) => toggle(SETTINGS_KEYS.notifFriendRequests, v, setNotifFriendRequests)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
            </View>
            <View style={styles.settingsDivider} />
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>Messages</Text>
              <Switch value={notifMessages} onValueChange={(v) => toggle(SETTINGS_KEYS.notifMessages, v, setNotifMessages)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
            </View>
            <View style={styles.settingsDivider} />
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>Nearby Dogs Alert</Text>
              <Switch value={notifNearby} onValueChange={(v) => toggle(SETTINGS_KEYS.notifNearby, v, setNotifNearby)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
            </View>
          </GlassCard>

          <Text style={styles.settingsHeader}>PRIVACY</Text>
          <GlassCard style={styles.settingsCard}>
            <View style={styles.settingsRow}>
              <View style={styles.settingsLabelWrap}>
                <Text style={styles.settingsLabel}>Show Me in Discover</Text>
                <Text style={styles.settingsSubLabel}>Let nearby dogs find you</Text>
              </View>
              <Switch value={showInDiscover} onValueChange={(v) => toggle(SETTINGS_KEYS.showInDiscover, v, setShowInDiscover)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
            </View>
            <View style={styles.settingsDivider} />
            <View style={styles.settingsRow}>
              <View style={styles.settingsLabelWrap}>
                <Text style={styles.settingsLabel}>Share My Location</Text>
                <Text style={styles.settingsSubLabel}>Required for Discover</Text>
              </View>
              <Switch value={shareLocation} onValueChange={(v) => toggle(SETTINGS_KEYS.shareLocation, v, setShareLocation)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
            </View>
          </GlassCard>

          <Text style={styles.settingsHeader}>ACCOUNT</Text>
          <GlassCard style={styles.settingsCard}>
            <TouchableOpacity style={styles.settingsRow} onPress={handleChangePassword}>
              <Text style={styles.settingsLabel}>Change Password</Text>
              <Text style={styles.settingsChevron}>›</Text>
            </TouchableOpacity>
            <View style={styles.settingsDivider} />
            <TouchableOpacity style={styles.settingsRow} onPress={() => { setSettingsVisible(false); setTimeout(() => handleDeleteDog(dog), 300); }}>
              <Text style={[styles.settingsLabel, { color: colors.error }]}>Remove Dog</Text>
              <Text style={styles.settingsChevron}>›</Text>
            </TouchableOpacity>
            <View style={styles.settingsDivider} />
            <TouchableOpacity style={styles.settingsRow} onPress={() => { setSettingsVisible(false); setTimeout(handleSignOut, 300); }}>
              <Text style={[styles.settingsLabel, { color: colors.error }]}>Sign Out</Text>
              <Text style={styles.settingsChevron}>›</Text>
            </TouchableOpacity>
            <View style={styles.settingsDivider} />
            <TouchableOpacity style={styles.settingsRow} onPress={handleDeleteAccount}>
              <Text style={[styles.settingsLabel, { color: colors.error, opacity: 0.7 }]}>Delete Account</Text>
              <Text style={styles.settingsChevron}>›</Text>
            </TouchableOpacity>
          </GlassCard>

          <Text style={styles.settingsVersion}>PawMeet v1.0.0</Text>
        </ScrollView>
      </Modal>

      <AddEditDogModal
        visible={modalVisible}
        dog={editingDog}
        onClose={() => setModalVisible(false)}
        onSaved={() => { setModalVisible(false); queryClient.invalidateQueries({ queryKey: ['dogs'] }); }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { alignItems: 'center', paddingBottom: spacing.xxl },

  switcherRow: {
    flexDirection: 'row', gap: spacing.sm,
    marginTop: spacing.lg, marginBottom: 0,
  },
  switcherPill: {
    paddingVertical: 6, paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  switcherPillActive: { borderColor: colors.primary, backgroundColor: 'rgba(47,128,237,0.15)' },
  switcherText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  switcherTextActive: { color: colors.primary, fontWeight: '700' },

  photoContainer: { marginTop: spacing.xl, marginBottom: spacing.lg },
  photo: { width: 150, height: 150, borderRadius: 40, borderWidth: 4, borderColor: colors.primary },
  photoPlaceholder: {
    width: 150, height: 150, borderRadius: 40,
    backgroundColor: colors.surfaceHigh, justifyContent: 'center', alignItems: 'center',
    borderWidth: 4, borderColor: colors.border,
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 40, justifyContent: 'center', alignItems: 'center',
  },
  cameraHint: {
    position: 'absolute', bottom: 6, right: 6,
    backgroundColor: colors.primary, borderRadius: 16, width: 32, height: 32,
    justifyContent: 'center', alignItems: 'center', ...shadow.sm,
  },
  cameraHintText: { fontSize: 15 },

  dogName: { ...typography.h1, color: colors.text },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs, justifyContent: 'center' },
  breedPill: {
    ...typography.bodySmall, color: colors.primary, fontWeight: '700',
    backgroundColor: colors.surfaceHigh, paddingHorizontal: spacing.md,
    paddingVertical: 3, borderRadius: borderRadius.full,
  },
  infoPill: {
    ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600',
    backgroundColor: colors.surfaceHigh, paddingHorizontal: spacing.md,
    paddingVertical: 3, borderRadius: borderRadius.full,
  },
  dogGender: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  extraPhotosRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  extraPhoto: { width: 90, height: 90, borderRadius: borderRadius.md },
  dogAge: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xs },

  compatRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  compatItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  compatIcon: { fontSize: 14 },
  compatLabel: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },

  healthRow: { flexDirection: 'row', marginTop: spacing.sm },

  chipsSection: { width: '90%', marginTop: spacing.md, alignItems: 'flex-start' },
  chipsLabel: { ...typography.caption, color: colors.textLight, fontWeight: '700', letterSpacing: 0.8, marginBottom: spacing.xs, textTransform: 'uppercase' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  readChip: {
    paddingVertical: 5, paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  readChipText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },

  dogBio: {
    ...typography.body, color: colors.textSecondary, textAlign: 'center',
    marginTop: spacing.md, paddingHorizontal: spacing.xl, lineHeight: 22,
  },

  speechBubble: {
    width: '90%', marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5, borderColor: colors.border,
    padding: spacing.md,
    borderBottomLeftRadius: 4,
  },
  speechQuestion: {
    ...typography.caption, color: colors.primary,
    fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: spacing.xs,
  },
  speechAnswer: { ...typography.body, color: colors.text, lineHeight: 22 },

  editBtn: {
    marginTop: spacing.lg,
    borderWidth: 1.5, borderColor: 'rgba(47,128,237,0.6)',
    borderRadius: borderRadius.full, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl,
    overflow: 'hidden',
    backgroundColor: 'rgba(47,128,237,0.08)',
  },
  editBtnText: { ...typography.body, color: colors.primary, fontWeight: '700' },

  addDogBtn: {
    marginTop: spacing.sm,
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: borderRadius.full, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl,
  },
  addDogBtnText: { ...typography.body, color: colors.textSecondary, fontWeight: '600' },

  statusRow: {
    flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  statusEmoji: { fontSize: 13 },
  statusLabel: { ...typography.bodySmall, color: colors.textSecondary },

  accountSection: {
    width: '90%', marginTop: spacing.md, padding: spacing.lg,
  },
  accountHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  accountLabel: {
    ...typography.caption, color: colors.textLight, fontWeight: '800',
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  accountEditLink: { ...typography.bodySmall, color: colors.primary, fontWeight: '700' },
  accountName: { ...typography.body, color: colors.text, fontWeight: '700' },
  accountEmail: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.sm },

  ownerInfoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  ownerInfoPill: {
    backgroundColor: colors.surfaceHigh, borderRadius: borderRadius.full,
    paddingVertical: 3, paddingHorizontal: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  ownerInfoPillText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  ownerBioText: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 20 },
  ownerInterestsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  ownerInterestChip: {
    backgroundColor: `${colors.primary}15`, borderRadius: borderRadius.full,
    paddingVertical: 4, paddingHorizontal: spacing.sm,
    borderWidth: 1, borderColor: `${colors.primary}40`,
  },
  ownerInterestChipText: { ...typography.caption, color: colors.primary, fontWeight: '600' },

  ownerModalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  ownerModalTitle: { ...typography.h3, color: colors.text },
  ownerModalCancel: { ...typography.body, color: colors.textSecondary },
  ownerModalSave: { ...typography.body, color: colors.primary, fontWeight: '700' },
  ownerModalContent: { padding: spacing.lg },
  ownerModalLabel: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '600' },
  ownerModalInput: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md,
    ...typography.body, color: colors.text,
  },
  ownerChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  ownerChip: {
    paddingVertical: 7, paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  ownerChipSelected: { borderColor: colors.primary, backgroundColor: `${colors.primary}15` },
  ownerChipText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  ownerChipTextSelected: { color: colors.primary, fontWeight: '700' },

  settingsSection: { width: '90%', marginTop: spacing.lg },
  settingsModalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.md, paddingTop: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  settingsModalTitle: { ...typography.h3, color: colors.text },
  settingsModalClose: { ...typography.body, color: colors.primary, fontWeight: '700' },
  settingsModalBody: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  settingsHeader: {
    ...typography.caption, color: colors.textLight, fontWeight: '800',
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginBottom: spacing.sm, marginTop: spacing.lg, marginLeft: spacing.xs,
  },
  settingsCard: { marginBottom: 0, padding: 0 },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, paddingHorizontal: spacing.md,
  },
  settingsLabelWrap: { flex: 1 },
  settingsLabel: { ...typography.body, color: colors.text },
  settingsSubLabel: { ...typography.caption, color: colors.textLight, marginTop: 2 },
  settingsDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
  settingsChevron: { fontSize: 20, color: colors.textLight, fontWeight: '300' },
  settingsVersion: {
    ...typography.caption, color: colors.textLight, textAlign: 'center',
    marginTop: spacing.xl, marginBottom: spacing.sm,
  },

  noDog: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, backgroundColor: colors.background },
  noDogEmoji: { fontSize: 80, marginBottom: spacing.md },
  noDogTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  noDogSubtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl, textAlign: 'center' },
  addBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.full, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, ...shadow.md },
  addBtnText: { ...typography.body, color: colors.background, fontWeight: '800' },
});
