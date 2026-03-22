import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../constants/theme';

const AVATAR_SIZE = 40;
const AVATAR_OFFSET = 20;

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  const m = minutes.toString().padStart(2, '0');
  return `${h}:${m} ${ampm}`;
}

type Props = {
  packName: string;
  packPhoto: string | null;
  memberDogPhotos: string[];
  memberCount: number;
  lastMessage: string | null;
  lastMessageTime: string | null;
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
  packPhoto,
  memberDogPhotos,
  memberCount,
  lastMessage,
  lastMessageTime,
  hasLiveMember,
  unreadCount,
  packType,
  onPress,
}: Props) {
  const timeLabel = lastMessageTime ? formatTime(lastMessageTime) : null;
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
      {/* Pack photo — left */}
      <View style={styles.packPhotoWrap}>
        {packPhoto ? (
          <Image source={{ uri: packPhoto }} style={styles.packPhoto} />
        ) : (
          <View style={[styles.packPhoto, styles.packPhotoPlaceholder]}>
            <Text style={{ fontSize: 24 }}>🐾</Text>
          </View>
        )}
      </View>

      {/* Pack info — right */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.packName} numberOfLines={1}>{packName}    <Text style={styles.typeBadgeText}>{TYPE_LABEL[packType]}</Text></Text>
        </View>
        {lastMessage ? (
          <Text style={styles.lastMessage} numberOfLines={1}>{lastMessage}</Text>
        ) : null}
        {hasLiveMember && (
          <View style={[styles.livePill, { alignSelf: 'flex-start' }]}>
            <Text style={styles.livePillText}>Live</Text>
          </View>
        )}
      </View>

      {/* Time + unread — top right column */}
      <View style={styles.rightCol}>
        {timeLabel && <Text style={styles.timeText}>{timeLabel}</Text>}
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{Math.min(unreadCount, 9)}</Text>
          </View>
        )}
      </View>
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
    fontSize: 15,
    color: colors.textLight,
    marginTop: 2,
  },
  packPhotoWrap: {
    position: 'relative',
    marginRight: spacing.sm,
  },
  packPhoto: {
    width: 50,
    height: 50,
    borderRadius: 14,
  },
  packPhotoPlaceholder: {
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
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
  rightCol: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  typeBadgeText: {
    fontSize: 10,
    lineHeight: 17,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
