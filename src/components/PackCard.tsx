import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../constants/theme';

const AVATAR_SIZE = 40;
const AVATAR_OFFSET = 20;

type Props = {
  packName: string;
  memberDogPhotos: string[];
  memberCount: number;
  lastMessage: string | null;
  hasLiveMember: boolean;
  unreadCount: number;
  packType: 'public' | 'semi_public' | 'private';
  onPress: () => void;
};

const TYPE_LABEL: Record<Props['packType'], string> = {
  public: '🌍 Public',
  semi_public: '🔓 Semi-public',
  private: '🔒 Private',
};

export default function PackCard({
  packName,
  memberDogPhotos,
  memberCount,
  lastMessage,
  hasLiveMember,
  unreadCount,
  packType,
  onPress,
}: Props) {
  const displayPhotos = memberDogPhotos.slice(0, 3);
  const stackWidth = displayPhotos.length > 0
    ? AVATAR_SIZE + (displayPhotos.length - 1) * AVATAR_OFFSET
    : AVATAR_SIZE;

  return (
    <TouchableOpacity
      style={[styles.card, hasLiveMember && styles.cardLive]}
      activeOpacity={0.75}
      onPress={onPress}
    >
      {/* Stacked avatars */}
      <View style={[styles.stackWrap, { width: stackWidth }]}>
        {displayPhotos.length === 0 ? (
          <View style={styles.avatarPlaceholder}>
            <Text style={{ fontSize: 22 }}>🐾</Text>
          </View>
        ) : (
          displayPhotos.map((photo, index) => (
            <View
              key={index}
              style={[
                styles.avatarOuterWrap,
                { left: index * AVATAR_OFFSET, zIndex: displayPhotos.length - index },
              ]}
            >
              <Image source={{ uri: photo }} style={styles.avatar} />
            </View>
          ))
        )}
      </View>

      {/* Pack info */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.packName} numberOfLines={1}>{packName}</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{Math.min(unreadCount, 9)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.memberCount}>{memberCount} {memberCount === 1 ? 'member' : 'members'}</Text>
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>{TYPE_LABEL[packType]}</Text>
        </View>
        {lastMessage ? (
          <Text style={styles.lastMessage} numberOfLines={1}>{lastMessage}</Text>
        ) : null}
      </View>

      {hasLiveMember && (
        <View style={styles.livePill}>
          <Text style={styles.livePillText}>Live</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardLive: {
    borderColor: colors.warning,
    borderWidth: 1.5,
  },
  stackWrap: {
    height: AVATAR_SIZE,
    position: 'relative',
    marginRight: spacing.md + spacing.xs,
  },
  avatarOuterWrap: {
    position: 'absolute',
    top: 0,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.surface,
    overflow: 'hidden',
    backgroundColor: colors.surfaceHigh,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  packName: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
  },
  memberCount: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  lastMessage: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 1,
  },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  unreadBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '800',
  },
  livePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    backgroundColor: colors.warning + '22',
    borderWidth: 1,
    borderColor: colors.warning,
    marginLeft: spacing.sm,
  },
  livePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.warning,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceHigh,
    marginTop: 2,
  },
  typeBadgeText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
