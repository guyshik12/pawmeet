import React from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, Dimensions,
} from 'react-native';
import { NearbyDogData } from '../../services/locationService';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_HEIGHT = 300;

const ENERGY_ORDER = ['Puppy', 'High Energy', 'Medium Energy', 'Low Energy', 'Senior'];
const SIZE_ORDER = ['Toy', 'Small', 'Medium', 'Large', 'Giant'];

function matchColor(pct: number): string {
  if (pct >= 80) return '#34C759';
  if (pct >= 60) return '#8BC34A';
  if (pct >= 40) return '#FFD60A';
  return '#FF9500';
}

type Props = {
  visible: boolean;
  dog: NearbyDogData | null;
  ownerName: string;
  matchPct: number | null;
  requestStatus?: 'pending' | 'accepted' | 'declined';
  onSayHi: () => void;
  onClose: () => void;
};

export default function DogProfileModal({ visible, dog, ownerName, matchPct, requestStatus, onSayHi, onClose }: Props) {
  if (!dog) return null;

  const allPhotos = [dog.photo_url, ...(dog.photos ?? [])].filter(Boolean) as string[];

  const renderSayHi = () => {
    if (requestStatus === 'accepted') {
      return <View style={styles.friendBadge}><Text style={styles.friendBadgeText}>Already Friends 🐾</Text></View>;
    }
    if (requestStatus === 'pending') {
      return <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>Request Sent 👋</Text></View>;
    }
    return (
      <TouchableOpacity style={styles.sayHiBtn} onPress={() => { onSayHi(); onClose(); }}>
        <Text style={styles.sayHiText}>Say Hi 👋</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Close button */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Photo gallery */}
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.gallery}
          >
            {allPhotos.length > 0 ? (
              allPhotos.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.galleryPhoto} />
              ))
            ) : (
              <View style={styles.galleryPlaceholder}>
                <Text style={{ fontSize: 72 }}>🐶</Text>
              </View>
            )}
          </ScrollView>

          {/* Photo dots */}
          {allPhotos.length > 1 && (
            <View style={styles.dotsRow}>
              {allPhotos.map((_, i) => (
                <View key={i} style={[styles.dot, i === 0 && styles.dotActive]} />
              ))}
            </View>
          )}

          <View style={styles.body}>
            {/* Name + match */}
            <View style={styles.nameRow}>
              <View>
                <Text style={styles.dogName}>{dog.name}</Text>
                {dog.gender ? (
                  <Text style={styles.gender}>
                    {dog.gender === 'Male' ? '♂' : '♀'} {dog.gender}
                  </Text>
                ) : null}
              </View>
              {matchPct !== null && (
                <View style={[styles.matchCircle, { borderColor: matchColor(matchPct) }]}>
                  <Text style={[styles.matchPct, { color: matchColor(matchPct) }]}>{matchPct}%</Text>
                  <Text style={styles.matchLabel}>match</Text>
                </View>
              )}
            </View>

            {/* Owner */}
            <Text style={styles.ownerName}>Owner: {ownerName}</Text>

            {/* Basic info pills */}
            <View style={styles.pillsRow}>
              {dog.breed ? <Text style={styles.breedPill}>{dog.breed}</Text> : null}
              {dog.age_years ? <Text style={styles.infoPill}>{dog.age_years} yrs</Text> : null}
              {dog.size ? <Text style={styles.infoPill}>{dog.size}</Text> : null}
              {dog.training_level ? <Text style={styles.infoPill}>{dog.training_level}</Text> : null}
            </View>

            {/* Energy */}
            {dog.energy_level ? (
              <View style={styles.energyTag}>
                <Text style={styles.energyTagText}>⚡ {dog.energy_level}</Text>
              </View>
            ) : null}

            {/* Compatibility */}
            {(dog.good_with_dogs || dog.good_with_kids) ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Compatibility</Text>
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
              </View>
            ) : null}

            {/* Health */}
            {(dog.vaccinated !== null || dog.neutered !== null) ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Health</Text>
                <View style={styles.healthRow}>
                  {dog.vaccinated !== null ? (
                    <View style={[styles.healthBadge, dog.vaccinated ? styles.healthYes : styles.healthNo]}>
                      <Text style={styles.healthText}>{dog.vaccinated ? '✓' : '✗'} Vaccinated</Text>
                    </View>
                  ) : null}
                  {dog.neutered !== null ? (
                    <View style={[styles.healthBadge, dog.neutered ? styles.healthYes : styles.healthNo]}>
                      <Text style={styles.healthText}>{dog.neutered ? '✓' : '✗'} Neutered</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Temperament */}
            {dog.temperament?.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Temperament</Text>
                <View style={styles.chipsWrap}>
                  {dog.temperament.map((t) => (
                    <View key={t} style={styles.readChip}>
                      <Text style={styles.readChipText}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Activities */}
            {dog.activities?.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Favorite Activities</Text>
                <View style={styles.chipsWrap}>
                  {dog.activities.map((a) => (
                    <View key={a} style={styles.readChip}>
                      <Text style={styles.readChipText}>{a}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Bio */}
            {dog.bio ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.bio}>{dog.bio}</Text>
              </View>
            ) : null}

            {/* Action */}
            <View style={styles.actionRow}>{renderSayHi()}</View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  closeBtn: {
    position: 'absolute', top: 16, right: 16, zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20,
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  gallery: { height: PHOTO_HEIGHT },
  galleryPhoto: { width: SCREEN_WIDTH, height: PHOTO_HEIGHT, resizeMode: 'cover' },
  galleryPlaceholder: {
    width: SCREEN_WIDTH, height: PHOTO_HEIGHT,
    backgroundColor: colors.surfaceHigh, justifyContent: 'center', alignItems: 'center',
  },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 18 },

  body: { padding: spacing.lg },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  dogName: { ...typography.h1, color: colors.text },
  gender: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  matchCircle: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 3, justifyContent: 'center', alignItems: 'center',
  },
  matchPct: { fontSize: 20, fontWeight: '800' },
  matchLabel: { ...typography.caption, color: colors.textSecondary },

  ownerName: { ...typography.caption, color: colors.textLight, marginTop: spacing.xs },

  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
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
  energyTag: {
    alignSelf: 'flex-start', marginTop: spacing.sm,
    backgroundColor: 'rgba(47,128,237,0.15)', borderRadius: borderRadius.full,
    paddingVertical: 4, paddingHorizontal: spacing.md,
  },
  energyTagText: { ...typography.bodySmall, color: colors.primary, fontWeight: '600' },

  section: { marginTop: spacing.lg },
  sectionTitle: {
    ...typography.caption, color: colors.textLight, fontWeight: '800',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing.sm,
  },

  compatRow: { flexDirection: 'row', gap: spacing.lg },
  compatItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  compatIcon: { fontSize: 16 },
  compatLabel: { ...typography.body, color: colors.textSecondary },

  healthRow: { flexDirection: 'row', gap: spacing.sm },
  healthBadge: {
    paddingVertical: 4, paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full, borderWidth: 1,
  },
  healthYes: { backgroundColor: 'rgba(52,199,89,0.1)', borderColor: '#34C759' },
  healthNo: { backgroundColor: 'rgba(255,59,48,0.1)', borderColor: '#FF3B30' },
  healthText: { ...typography.bodySmall, fontWeight: '700', color: colors.text },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  readChip: {
    paddingVertical: 5, paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  readChipText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },

  bio: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },

  actionRow: { marginTop: spacing.xl, alignItems: 'center' },
  sayHiBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.full,
    paddingVertical: spacing.md, paddingHorizontal: spacing.xxl,
    shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  sayHiText: { ...typography.body, color: colors.background, fontWeight: '800' },
  pendingBadge: {
    backgroundColor: colors.border, borderRadius: borderRadius.full,
    paddingVertical: spacing.md, paddingHorizontal: spacing.xxl,
  },
  pendingBadgeText: { ...typography.body, color: colors.textSecondary, fontWeight: '600' },
  friendBadge: {
    backgroundColor: colors.surfaceHigh, borderRadius: borderRadius.full,
    paddingVertical: spacing.md, paddingHorizontal: spacing.xxl,
  },
  friendBadgeText: { ...typography.body, color: colors.primary, fontWeight: '800' },
});
