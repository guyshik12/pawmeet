import React from 'react';
import {
  View, Text, StyleSheet, Dimensions, ScrollView,
  Image, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { sendMessage } from '../../services/chatService';
import { FriendDogProfile, FriendOwnerProfile } from '../../services/friendService';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/ui/Toast';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_HEIGHT * 0.64;

export type FriendProfileParams = {
  dog: FriendDogProfile;
  ownerProfile: FriendOwnerProfile;
  ownerId: string;
  friendshipId: string;
  isUserA: boolean;
  friendName: string;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ownerStatusColor(status: 'active' | 'looking' | 'offline') {
  if (status === 'active') return '#34C759';
  if (status === 'looking') return '#FFD60A';
  return '#555555';
}

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

function OwnerSection({ owner }: { owner: FriendOwnerProfile }) {
  const statusLabel =
    owner.status === 'active' ? 'Active now' :
    owner.status === 'looking' ? 'Looking to meet' : 'Offline';

  return (
    <View style={styles.ownerCard}>
      <Text style={styles.sectionTitle}>Meet the Human</Text>
      <View style={styles.ownerTop}>
        <View style={styles.ownerAvatarWrap}>
          {owner.photo_url ? (
            <Image source={{ uri: owner.photo_url }} style={styles.ownerAvatar} resizeMode="cover" />
          ) : (
            <View style={styles.ownerAvatarPlaceholder}>
              <Text style={{ fontSize: 28 }}>👤</Text>
            </View>
          )}
          <View style={[styles.ownerStatusDot, { backgroundColor: ownerStatusColor(owner.status) }]} />
        </View>
        <View style={styles.ownerMeta}>
          <View style={styles.ownerNameRow}>
            <Text style={styles.ownerNameText}>{owner.name}</Text>
            {owner.verified && (
              <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓</Text></View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <View style={[styles.statusDotSmall, { backgroundColor: ownerStatusColor(owner.status) }]} />
            <Text style={styles.ownerStatusLabel}>{statusLabel}</Text>
          </View>
        </View>
      </View>

      {(owner.age || owner.occupation || owner.neighborhood) ? (
        <View style={styles.pillRow}>
          {owner.age ? <View style={styles.pill}><Text style={styles.pillText}>🎂 {owner.age}</Text></View> : null}
          {owner.occupation ? <View style={styles.pill}><Text style={styles.pillText}>💼 {owner.occupation}</Text></View> : null}
          {owner.neighborhood ? <View style={styles.pill}><Text style={styles.pillText}>📍 {owner.neighborhood}</Text></View> : null}
        </View>
      ) : null}

      {owner.bio ? <Text style={styles.ownerBio}>{owner.bio}</Text> : null}

      {owner.interests?.length ? (
        <View style={styles.chipRow}>
          {owner.interests.map((i) => (
            <View key={i} style={styles.chip}><Text style={styles.chipText}>{i}</Text></View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ProfileBody({ dog, owner }: { dog: FriendDogProfile; owner: FriendOwnerProfile }) {
  const extraPhotos = (dog.photos ?? []).filter(Boolean);
  const prompts = (dog.prompts ?? []).filter((p) => p.question && p.answer);

  return (
    <View style={styles.body}>
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

      {prompts[0] ? <SpeechBubble question={prompts[0].question} answer={prompts[0].answer} /> : null}
      {extraPhotos[0] ? <InlinePhoto uri={extraPhotos[0]} /> : null}

      {(dog.good_with_dogs || dog.good_with_kids) ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compatibility</Text>
          <View style={styles.compatRow}>
            {dog.good_with_dogs ? (
              <View style={styles.compatItem}>
                <Text style={styles.compatIcon}>🐾</Text>
                <Text style={styles.compatLabel}>With dogs</Text>
                <Text style={[styles.compatValue, {
                  color: dog.good_with_dogs === 'Yes' ? '#34C759' : dog.good_with_dogs === 'No' ? colors.error : colors.textSecondary,
                }]}>{dog.good_with_dogs}</Text>
              </View>
            ) : null}
            {dog.good_with_kids ? (
              <View style={styles.compatItem}>
                <Text style={styles.compatIcon}>👶</Text>
                <Text style={styles.compatLabel}>With kids</Text>
                <Text style={[styles.compatValue, {
                  color: dog.good_with_kids === 'Yes' ? '#34C759' : dog.good_with_kids === 'No' ? colors.error : colors.textSecondary,
                }]}>{dog.good_with_kids}</Text>
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

      {prompts[1] ? <SpeechBubble question={prompts[1].question} answer={prompts[1].answer} /> : null}
      {extraPhotos[1] ? <InlinePhoto uri={extraPhotos[1]} /> : null}

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

      {prompts[2] ? <SpeechBubble question={prompts[2].question} answer={prompts[2].answer} /> : null}

      <OwnerSection owner={owner} />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FriendProfileScreen({ route, navigation }: any) {
  const { dog, ownerProfile, friendshipId, isUserA, friendName } = route.params as FriendProfileParams;
  const { user } = useAuthStore();
  const { toast, showToast, hideToast } = useToast();

  const woofMutation = useMutation({
    mutationFn: () => sendMessage(friendshipId, user!.id, '🐾 Quick Woof! Want to meet up?'),
    onSuccess: () => showToast('Woof sent! 🐾', 'success'),
    onError: () => showToast('Could not send woof.', 'error'),
  });

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingBottom: 96 }}>
        {/* Hero */}
        <View style={{ height: HERO_HEIGHT }}>
          {dog.photo_url ? (
            <Image source={{ uri: dog.photo_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.photoPlaceholder]}>
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
                <Text style={styles.dogName}>{dog.name}</Text>
                {dog.gender ? (
                  <View style={styles.genderBadge}>
                    <Text style={styles.genderText}>{dog.gender === 'Male' ? '♂' : '♀'}</Text>
                  </View>
                ) : null}
              </View>
              {(dog.breed || dog.age_years) ? (
                <Text style={styles.dogBreed}>
                  {[dog.breed, dog.age_years ? `${dog.age_years} yrs` : null].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
              <View style={styles.tagsRow}>
                {dog.size ? <View style={styles.tag}><Text style={styles.tagText}>{dog.size}</Text></View> : null}
                {dog.energy_level ? <View style={styles.tag}><Text style={styles.tagText}>{dog.energy_level}</Text></View> : null}
                {dog.good_with_dogs === 'Yes' ? <View style={styles.tag}><Text style={styles.tagText}>🐾 Good w/ dogs</Text></View> : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <View style={[styles.statusDotSmall, { backgroundColor: ownerStatusColor(ownerProfile.status) }]} />
                <Text style={styles.ownerLine}>{ownerProfile.name}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Profile body */}
        <ProfileBody dog={dog} owner={ownerProfile} />
      </ScrollView>

      {/* Action bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.woofBtn} onPress={() => woofMutation.mutate()}>
          <Text style={styles.woofBtnText}>🐾</Text>
          <Text style={styles.woofBtnLabel}>Woof</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.chatBtn}
          onPress={() => navigation.navigate('Chat', {
            friendshipId,
            friendName: ownerProfile.name,
            friendDogName: dog.name,
            isUserA,
          })}
        >
          <Text style={styles.chatBtnText}>💬 Chat with {dog.name}</Text>
        </TouchableOpacity>
      </View>

      <Toast message={toast.message} type={toast.type} visible={toast.visible} onHide={hideToast} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  photoPlaceholder: { backgroundColor: colors.surfaceHigh, justifyContent: 'center', alignItems: 'center' },
  gradient: { justifyContent: 'flex-end' },
  heroInfo: { padding: spacing.lg, paddingBottom: spacing.xl },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  dogName: { fontSize: 32, fontWeight: '900', color: '#fff' },
  genderBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
  },
  genderText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dogBreed: { fontSize: 16, color: 'rgba(255,255,255,0.8)', marginTop: 4, fontWeight: '500' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  tagText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  ownerLine: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' },
  statusDotSmall: { width: 8, height: 8, borderRadius: 4 },

  body: { padding: spacing.lg, gap: spacing.lg },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.h3, color: colors.primary, fontWeight: '800', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8 },
  bioText: { ...typography.body, color: colors.text, lineHeight: 22 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    backgroundColor: colors.surfaceHigh, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  pillText: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.surface, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: colors.border,
  },
  chipText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  compatRow: { flexDirection: 'row', gap: spacing.md },
  compatItem: { flex: 1, alignItems: 'center', gap: 4 },
  compatIcon: { fontSize: 22 },
  compatLabel: { ...typography.caption, color: colors.textSecondary },
  compatValue: { ...typography.bodySmall, fontWeight: '700' },
  healthBadge: {
    borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  speechBubble: {
    backgroundColor: colors.surface, borderRadius: 18,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, gap: 6,
  },
  speechQuestion: { ...typography.bodySmall, color: colors.primary, fontWeight: '700' },
  speechAnswer: { ...typography.body, color: colors.text, lineHeight: 22 },
  inlinePhotoWrap: { borderRadius: 24, overflow: 'hidden', height: SCREEN_HEIGHT * 0.64 },
  inlinePhoto: { width: '100%', height: '100%' },

  ownerCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.lg, gap: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  ownerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ownerAvatarWrap: { position: 'relative' },
  ownerAvatar: { width: 56, height: 56, borderRadius: 28 },
  ownerAvatarPlaceholder: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.surfaceHigh, justifyContent: 'center', alignItems: 'center',
  },
  ownerStatusDot: { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.surface },
  ownerMeta: { flex: 1 },
  ownerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ownerNameText: { ...typography.h3, color: colors.text, fontWeight: '800' },
  verifiedBadge: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  verifiedText: { fontSize: 9, color: '#fff', fontWeight: '800' },
  ownerStatusLabel: { ...typography.caption, color: colors.textSecondary },
  ownerBio: { ...typography.body, color: colors.text, lineHeight: 22 },

  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: spacing.sm,
    padding: spacing.md, paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  woofBtn: {
    width: 56, height: 56, borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceHigh, justifyContent: 'center', alignItems: 'center',
  },
  woofBtnText: { fontSize: 20 },
  woofBtnLabel: { ...typography.caption, color: colors.textSecondary, fontSize: 10 },
  chatBtn: {
    flex: 1, height: 56, borderRadius: borderRadius.md,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  chatBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
