import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
  getPendingRequests, getPackMembersWithRoles,
  approveJoinRequest, dismissJoinRequest, updateMemberRole,
  removeMember, addMemberToPack, updatePackPhoto,
  PendingRequest, PackMemberWithRole,
} from '../../services/packService';
import { getFriends } from '../../services/friendService';
import { useDogStore } from '../../store/dogStore';
import { supabase } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

type Props = {
  route: { params: { packId: string; packName: string } };
  navigation: any;
};

export default function PackRequestsScreen({ route, navigation }: Props) {
  const { packId, packName } = route.params;
  const { user } = useAuthStore();
  const { currentDog } = useDogStore();
  const activeDog = currentDog();
  const queryClient = useQueryClient();
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [showAddFriends, setShowAddFriends] = useState(false);

  React.useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: -4 }}>
          <Text style={{ fontSize: 40, color: colors.primary }}>‹</Text>
        </TouchableOpacity>
      ),
      headerTitle: () => (
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>Pack Info</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{packName}</Text>
        </View>
      ),
    });
  }, [packName]);

  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['pack_requests', packId],
    queryFn: () => getPendingRequests(packId),
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['pack_members_roles', packId],
    queryFn: () => getPackMembersWithRoles(packId),
  });

  const { data: packData } = useQuery({
    queryKey: ['pack_data', packId],
    queryFn: async () => {
      const { data } = await supabase
        .from('packs')
        .select('created_by, photo_url')
        .eq('id', packId)
        .single();
      return data as any;
    },
  });

  const packCreatorId = packData?.created_by ?? null;
  const packPhoto = packData?.photo_url ?? null;

  const isCreator = user?.id === packCreatorId;
  const isLeader = members.some((m) => m.userId === user?.id && m.role === 'leader');

  const { data: friends = [] } = useQuery({
    queryKey: ['friends', user?.id],
    queryFn: () => getFriends(activeDog ? [activeDog.id] : []),
    enabled: !!user && showAddFriends,
  });

  // Friends not already in the pack
  const memberUserIds = new Set(members.map((m) => m.userId));
  const addableFriends = friends.filter((f) => !memberUserIds.has(f.friendDog.owner_id));

  function addProcessing(id: string) {
    setProcessingIds((prev) => new Set([...prev, id]));
  }

  function removeProcessing(id: string) {
    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleApprove(req: PendingRequest) {
    addProcessing(req.id);
    try {
      await approveJoinRequest(req.id, req.packId, req.userId, req.dogId, req.dogName, user!.id);
      queryClient.invalidateQueries({ queryKey: ['pack_requests', packId] });
      queryClient.invalidateQueries({ queryKey: ['pack_members_roles', packId] });
      queryClient.invalidateQueries({ queryKey: ['pack_members', packId] });
    } catch (e) {
      console.error('[PackRequestsScreen] approve error:', e);
    } finally {
      removeProcessing(req.id);
    }
  }

  async function handleDismiss(req: PendingRequest) {
    addProcessing(req.id);
    try {
      await dismissJoinRequest(req.id);
      queryClient.invalidateQueries({ queryKey: ['pack_requests', packId] });
    } catch (e) {
      console.error('[PackRequestsScreen] dismiss error:', e);
    } finally {
      removeProcessing(req.id);
    }
  }

  async function handlePromote(member: PackMemberWithRole) {
    const pid = member.dogId ?? member.userId;
    addProcessing(pid);
    try {
      await updateMemberRole(packId, member.userId, 'leader');
      queryClient.invalidateQueries({ queryKey: ['pack_members_roles', packId] });
    } catch (e) {
      console.error('[PackRequestsScreen] promote error:', e);
    } finally {
      removeProcessing(pid);
    }
  }

  async function handleDemote(member: PackMemberWithRole) {
    const pid = member.dogId ?? member.userId;
    addProcessing(pid);
    try {
      await updateMemberRole(packId, member.userId, 'member');
      queryClient.invalidateQueries({ queryKey: ['pack_members_roles', packId] });
    } catch (e) {
      console.error('[PackRequestsScreen] demote error:', e);
    } finally {
      removeProcessing(pid);
    }
  }

  async function handleRemove(member: PackMemberWithRole) {
    const pid = member.dogId ?? member.userId;
    addProcessing(pid);
    try {
      await removeMember(packId, member.userId, member.dogName, user!.id);
      queryClient.invalidateQueries({ queryKey: ['pack_members_roles', packId] });
      queryClient.invalidateQueries({ queryKey: ['pack_members', packId] });
    } catch (e) {
      console.error('[PackRequestsScreen] remove error:', e);
    } finally {
      removeProcessing(pid);
    }
  }

  async function handleAddFriend(friendDogOwnerId: string, friendDogId: string, friendDogName: string) {
    addProcessing(friendDogOwnerId);
    try {
      await addMemberToPack(packId, friendDogOwnerId, friendDogId, friendDogName, user!.id);
      queryClient.invalidateQueries({ queryKey: ['pack_members_roles', packId] });
      queryClient.invalidateQueries({ queryKey: ['pack_members', packId] });
    } catch (e) {
      console.error('[PackRequestsScreen] add friend error:', e);
    } finally {
      removeProcessing(friendDogOwnerId);
    }
  }

  async function handleChangePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;
    try {
      await updatePackPhoto(packId, result.assets[0].uri);
      queryClient.invalidateQueries({ queryKey: ['pack_data', packId] });
      queryClient.invalidateQueries({ queryKey: ['packs'] });
    } catch (e) {
      console.error('[PackRequestsScreen] photo upload error:', e);
    }
  }

  const isLoading = requestsLoading || membersLoading;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <>
            {/* Pack photo + name header */}
            <View style={styles.packHeader}>
              <TouchableOpacity onPress={isLeader ? handleChangePhoto : undefined} activeOpacity={isLeader ? 0.7 : 1}>
                {packPhoto ? (
                  <Image source={{ uri: packPhoto }} style={styles.packHeaderPhoto} />
                ) : (
                  <View style={[styles.packHeaderPhoto, styles.packHeaderPhotoPlaceholder]}>
                    <Text style={{ fontSize: 36 }}>🐾</Text>
                  </View>
                )}
                {isLeader && (
                  <View style={styles.changePhotoHint}>
                    <Text style={{ fontSize: 10, color: '#fff' }}>📷</Text>
                  </View>
                )}
              </TouchableOpacity>
              <Text style={styles.packHeaderName}>{packName}</Text>
              <Text style={styles.packHeaderCount}>{members.length} {members.length === 1 ? 'member' : 'members'}</Text>
            </View>

            {/* Pending Requests Section — leaders only */}
            {isLeader && <Text style={styles.sectionHeader}>
              Pending Requests ({requests.length})
            </Text>}
            {isLeader && (requests.length === 0 ? (
              <Text style={styles.emptyText}>No pending requests 🐾</Text>
            ) : (
              requests.map((req) => (
                <View key={req.id} style={styles.row}>
                  {req.dogPhoto ? (
                    <Image source={{ uri: req.dogPhoto }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Text style={{ fontSize: 18 }}>🐶</Text>
                    </View>
                  )}
                  <View style={styles.info}>
                    <Text style={styles.name}>{req.dogName}</Text>
                    <Text style={styles.meta}>with {req.ownerName}</Text>
                  </View>
                  {processingIds.has(req.id) ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={styles.approveBtn}
                        onPress={() => handleApprove(req)}
                      >
                        <Text style={styles.approveBtnText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.dismissBtn}
                        onPress={() => handleDismiss(req)}
                      >
                        <Text style={styles.dismissBtnText}>Dismiss</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            ))}

            {/* Members Section */}
            <Text style={[styles.sectionHeader, { marginTop: spacing.lg }]}>
              Pack Members ({members.length})
            </Text>
            {members.map((member) => (
              <View key={member.dogId ?? member.userId} style={styles.row}>
                {member.dogPhoto ? (
                  <Image source={{ uri: member.dogPhoto }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={{ fontSize: 18 }}>🐶</Text>
                  </View>
                )}
                <View style={styles.info}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.name}>{member.dogName}</Text>
                    {member.role === 'leader' && (
                      <View style={styles.leaderBadge}>
                        <Text style={styles.leaderBadgeText}>🐕 Pack Leader</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.meta}>
                    {member.userId === user?.id ? 'You' : member.dogName}
                  </Text>
                </View>
                {isLeader && member.userId !== user?.id && member.userId !== packCreatorId && (
                  processingIds.has(member.dogId ?? member.userId) ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <View style={styles.actions}>
                      {member.role === 'leader' && isCreator ? (
                        <TouchableOpacity
                          style={styles.demoteBtn}
                          onPress={() => handleDemote(member)}
                        >
                          <Text style={styles.demoteBtnText}>Remove Leader</Text>
                        </TouchableOpacity>
                      ) : member.role !== 'leader' ? (
                        <TouchableOpacity
                          style={styles.promoteBtn}
                          onPress={() => handlePromote(member)}
                        >
                          <Text style={styles.promoteBtnText}>Make Leader</Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => handleRemove(member)}
                      >
                        <Text style={styles.removeBtnText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  )
                )}
              </View>
            ))}

            {/* Add Friends Section — leaders only */}
            {isLeader && <TouchableOpacity
              style={styles.addFriendsToggle}
              onPress={() => setShowAddFriends(!showAddFriends)}
            >
              <Text style={styles.addFriendsToggleText}>
                {showAddFriends ? '− Hide Friends' : '+ Add Friends'}
              </Text>
            </TouchableOpacity>}

            {isLeader && showAddFriends && (
              <>
                {addableFriends.length === 0 ? (
                  <Text style={styles.emptyText}>
                    {friends.length === 0 ? 'Loading friends...' : 'All your friends are already in this pack 🐾'}
                  </Text>
                ) : (
                  addableFriends.map((friend) => (
                    <View key={friend.id} style={styles.row}>
                      {friend.friendDog?.photo_url ? (
                        <Image source={{ uri: friend.friendDog.photo_url }} style={styles.avatar} />
                      ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                          <Text style={{ fontSize: 18 }}>🐶</Text>
                        </View>
                      )}
                      <View style={styles.info}>
                        <Text style={styles.name}>{friend.friendDog?.name ?? '?'}</Text>
                        <Text style={styles.meta}>with {friend.friendOwner.name}</Text>
                      </View>
                      {processingIds.has(friend.friendDog.owner_id) ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <TouchableOpacity
                          style={styles.approveBtn}
                          onPress={() => handleAddFriend(friend.friendDog.owner_id, friend.friendDog.id, friend.friendDog.name ?? 'A dog')}
                        >
                          <Text style={styles.approveBtnText}>Add</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}
              </>
            )}
          </>
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  list: { padding: spacing.md },
  sectionHeader: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHigh,
    gap: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: { flex: 1 },
  name: { ...typography.body, fontWeight: '700', color: colors.text },
  meta: { ...typography.bodySmall, color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: 6 },
  approveBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  approveBtnText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  dismissBtn: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  dismissBtnText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  promoteBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  promoteBtnText: { fontSize: 10, color: colors.primary, fontWeight: '600' },
  leaderBadge: {
    backgroundColor: colors.primary + '22',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  leaderBadgeText: { fontSize: 10, color: colors.primary, fontWeight: '600' },
  packHeader: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHigh,
    marginBottom: spacing.md,
  },
  packHeaderPhoto: {
    width: 80,
    height: 80,
    borderRadius: 24,
    marginBottom: spacing.sm,
  },
  packHeaderPhotoPlaceholder: {
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoHint: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  packHeaderName: {
    ...typography.h3,
    color: colors.text,
    marginBottom: 2,
  },
  packHeaderCount: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  demoteBtn: {
    borderWidth: 1,
    borderColor: '#FF6B6B',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  demoteBtnText: { fontSize: 10, color: '#FF6B6B', fontWeight: '600' },
  removeBtn: {
    backgroundColor: '#FF6B6B22',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  removeBtnText: { fontSize: 10, color: '#FF6B6B', fontWeight: '600' },
  addFriendsToggle: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    borderStyle: 'dashed',
  },
  addFriendsToggleText: { ...typography.body, color: colors.primary, fontWeight: '600' },
});
