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
  PendingRequest, PackMemberWithRole,
} from '../../services/packService';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

type Props = {
  route: { params: { packId: string; packName: string } };
  navigation: any;
};

export default function PackRequestsScreen({ route, navigation }: Props) {
  const { packId, packName } = route.params;
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    navigation.setOptions({
      title: 'Pack Requests',
      headerRight: () => (
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginRight: spacing.sm }}>
          {packName}
        </Text>
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
      await approveJoinRequest(req.id, req.packId, req.userId, req.dogId);
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
    addProcessing(member.userId);
    try {
      await updateMemberRole(packId, member.userId, 'leader');
      queryClient.invalidateQueries({ queryKey: ['pack_members_roles', packId] });
    } catch (e) {
      console.error('[PackRequestsScreen] promote error:', e);
    } finally {
      removeProcessing(member.userId);
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
            {/* Pending Requests Section */}
            <Text style={styles.sectionHeader}>
              Pending Requests ({requests.length})
            </Text>
            {requests.length === 0 ? (
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
            )}

            {/* Members Section */}
            <Text style={[styles.sectionHeader, { marginTop: spacing.lg }]}>
              Pack Members ({members.length})
            </Text>
            {members.map((member) => (
              <View key={member.userId} style={styles.row}>
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
                {member.role !== 'leader' && (
                  processingIds.has(member.userId) ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <TouchableOpacity
                      style={styles.promoteBtn}
                      onPress={() => handlePromote(member)}
                    >
                      <Text style={styles.promoteBtnText}>Make Leader</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            ))}
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
});
