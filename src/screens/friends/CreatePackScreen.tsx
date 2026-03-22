import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Image, ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useDogStore } from '../../store/dogStore';
import { getFriends } from '../../services/friendService';
import { createPack } from '../../services/packService';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

type PackType = 'public' | 'semi_public' | 'private';

const TYPE_OPTIONS: { value: PackType; icon: string; label: string; description: string }[] = [
  { value: 'public', icon: '🌍', label: 'Public', description: 'Anyone can find and join' },
  { value: 'semi_public', icon: '🔓', label: 'Semi-public', description: 'Visible in search · Join needs approval' },
  { value: 'private', icon: '🔒', label: 'Private', description: 'Invite only · Not in search' },
];

export default function CreatePackScreen({ navigation }: { navigation: any }) {
  const { user } = useAuthStore();
  const { currentDog } = useDogStore();
  const activeDog = currentDog();
  const userId = user?.id ?? '';

  const [packName, setPackName] = useState('');
  const [packType, setPackType] = useState<PackType>('public');
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();

  const { data: friends = [], isLoading } = useQuery({
    queryKey: ['friends', userId],
    queryFn: () => getFriends(activeDog ? [activeDog.id] : []),
    enabled: !!user,
  });

  function toggleFriend(friendshipId: string) {
    setSelectedFriendIds((prev) => {
      const next = new Set(prev);
      if (next.has(friendshipId)) next.delete(friendshipId);
      else next.add(friendshipId);
      return next;
    });
  }

  const isValid =
    packName.trim().length > 0 &&
    (packType !== 'private' || selectedFriendIds.size > 0);

  async function handleCreate() {
    if (!isValid || creating || !user) return;
    setCreating(true);
    try {
      const selectedFriends = friends
        .filter((f) => selectedFriendIds.has(f.id))
        .map((f) => ({ userId: f.friendDog.owner_id, dogId: f.friendDog.id }));

      const pack = await createPack(
        packName.trim(),
        userId,
        activeDog?.id ?? null,
        packType,
        selectedFriends,
      );
      queryClient.invalidateQueries({ queryKey: ['packs'] });
      navigation.replace('PackChat', {
        packId: pack.id,
        packName: pack.name,
        memberCount: selectedFriends.length + 1,
      });
    } catch (e) {
      console.error('[CreatePackScreen] createPack error:', e);
    } finally {
      setCreating(false);
    }
  }

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={handleCreate}
          disabled={!isValid || creating}
          style={{ marginRight: spacing.sm }}
        >
          {creating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.createBtn, !isValid && styles.createBtnDisabled]}>Create</Text>
          )}
        </TouchableOpacity>
      ),
    });
  }, [packName, packType, selectedFriendIds, creating]);

  return (
    <View style={styles.container}>
      {/* Pack name */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Pack Name</Text>
        <TextInput
          style={styles.nameInput}
          placeholder="e.g. Park Legends"
          placeholderTextColor={colors.textSecondary}
          value={packName}
          onChangeText={setPackName}
          autoFocus
          maxLength={40}
        />
      </View>

      {/* Pack type */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Type</Text>
        {TYPE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.typeRow, packType === opt.value && styles.typeRowSelected]}
            onPress={() => setPackType(opt.value)}
            activeOpacity={0.7}
          >
            <Text style={styles.typeIcon}>{opt.icon}</Text>
            <View style={styles.typeInfo}>
              <Text style={styles.typeLabel}>{opt.label}</Text>
              <Text style={styles.typeDesc}>{opt.description}</Text>
            </View>
            {packType === opt.value && (
              <View style={styles.radioSelected}>
                <Text style={{ fontSize: 10, color: '#fff' }}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Friend picker */}
      <View style={[styles.section, { flex: 1 }]}>
        <Text style={styles.sectionLabel}>
          Add Friends {packType === 'private' ? '(required)' : '(optional)'}
        </Text>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : friends.length === 0 ? (
          <Text style={styles.emptyFriends}>No friends yet — add some from Discover first.</Text>
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(f) => f.id}
            renderItem={({ item }) => {
              const selected = selectedFriendIds.has(item.id);
              return (
                <TouchableOpacity
                  style={styles.friendRow}
                  onPress={() => toggleFriend(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    {selected && <Text style={{ fontSize: 10, color: '#fff' }}>✓</Text>}
                  </View>
                  {item.friendDog?.photo_url ? (
                    <Image source={{ uri: item.friendDog.photo_url }} style={styles.friendAvatar} />
                  ) : (
                    <View style={[styles.friendAvatar, styles.friendAvatarPlaceholder]}>
                      <Text style={{ fontSize: 18 }}>🐶</Text>
                    </View>
                  )}
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendDogName}>{item.friendDog?.name ?? '?'}</Text>
                    <Text style={styles.friendOwnerName}>with {item.friendOwner.name}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  section: { paddingHorizontal: spacing.md, paddingTop: spacing.md, marginBottom: spacing.sm },
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  nameInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceHigh,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  typeRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  typeIcon: { fontSize: 22, marginRight: spacing.sm },
  typeInfo: { flex: 1 },
  typeLabel: { ...typography.body, fontWeight: '700', color: colors.text },
  typeDesc: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  radioSelected: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHigh,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  friendAvatar: { width: 40, height: 40, borderRadius: 12, marginRight: spacing.sm },
  friendAvatarPlaceholder: {
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendInfo: { flex: 1 },
  friendDogName: { ...typography.body, fontWeight: '700', color: colors.text },
  friendOwnerName: { ...typography.bodySmall, color: colors.textSecondary },
  emptyFriends: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  createBtn: { ...typography.body, color: colors.primary, fontWeight: '700' },
  createBtnDisabled: { color: colors.textSecondary },
});
