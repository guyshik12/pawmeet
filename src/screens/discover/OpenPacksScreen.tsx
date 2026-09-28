import React, { useState, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TouchableWithoutFeedback,
  Image, StyleSheet, ActivityIndicator, Alert, Animated,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { CommonActions } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { useDogStore } from '../../store/dogStore';
import { getNeighborhoodPacks, NeighborhoodPack } from '../../services/hubService';
import { joinPack, createJoinRequest, getPackMembersWithRoles, PackMemberWithRole } from '../../services/packService';
import { supabase } from '../../lib/supabase';

const hub = {
  bg: '#121212',
  surface: '#1E1E1E',
  border: '#2A2A2A',
  amber: '#FFB347',
  text: '#EEEEEE',
  textSecondary: '#888888',
  textMuted: '#555555',
};

export default function OpenPacksScreen({ navigation }: { navigation: any }) {
  const { user } = useAuthStore();
  const { currentDog } = useDogStore();
  const myDog = currentDog();
  const userId = user?.id ?? '';

  const [previewPack, setPreviewPack] = useState<NeighborhoodPack | null>(null);
  const [previewMembers, setPreviewMembers] = useState<PackMemberWithRole[]>([]);
  const sheetAnim = useRef(new Animated.Value(360)).current;

  const { data: packs = [], isLoading } = useQuery({
    queryKey: ['hub_packs_all'],
    queryFn: () => getNeighborhoodPacks(userId, myDog?.id),
    enabled: !!userId,
  });

  const { data: myPackIds = new Set<string>() } = useQuery({
    queryKey: ['my_pack_ids', myDog?.id],
    queryFn: async () => {
      if (!myDog?.id) return new Set<string>();
      const { data } = await supabase
        .from('pack_members')
        .select('pack_id')
        .eq('dog_id', myDog.id);
      return new Set((data ?? []).map((m: any) => m.pack_id));
    },
    enabled: !!myDog?.id,
  });

  async function openPreview(pack: NeighborhoodPack) {
    setPreviewPack(pack);
    setPreviewMembers([]);
    Animated.spring(sheetAnim, {
      toValue: 0, useNativeDriver: true, damping: 18, stiffness: 160,
    }).start();
    try {
      const members = await getPackMembersWithRoles(pack.id);
      setPreviewMembers(members.slice(0, 5));
    } catch {}
  }

  function closePreview() {
    Animated.spring(sheetAnim, {
      toValue: 360, useNativeDriver: true, damping: 18, stiffness: 160,
    }).start(() => { setPreviewPack(null); setPreviewMembers([]); });
  }

  function goToPackChat(id: string, name: string, count: number) {
    navigation.dispatch(
      CommonActions.navigate('FriendsStack', {
        screen: 'PackChat',
        params: { packId: id, packName: name, memberCount: count },
      })
    );
  }

  async function handleAction(pack: NeighborhoodPack) {
    closePreview();
    if (myPackIds.has(pack.id)) {
      goToPackChat(pack.id, pack.name, pack.memberCount);
    } else if (pack.type === 'public') {
      try {
        await joinPack(pack.id, userId, myDog?.id ?? null);
        goToPackChat(pack.id, pack.name, pack.memberCount + 1);
      } catch {
        Alert.alert('Error', 'Could not join pack');
      }
    } else {
      try {
        await createJoinRequest(pack.id, userId, myDog?.id ?? null);
        Alert.alert('Request Sent', `Your request to join ${pack.name} has been sent to the Pack Leaders.`);
      } catch {
        Alert.alert('Already Requested', 'You already sent a request to this pack.');
      }
    }
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={hub.amber} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={packs}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.packRow} activeOpacity={0.7} onPress={() => openPreview(item)}>
            {item.photo_url ? (
              <Image source={{ uri: item.photo_url }} style={styles.packPhoto} />
            ) : (
              <View style={[styles.packPhoto, styles.packPhotoPlaceholder]}>
                <Text style={{ fontSize: 24 }}>🐾</Text>
              </View>
            )}
            <View style={styles.packInfo}>
              <Text style={styles.packName}>{item.name}</Text>
              <Text style={styles.packMeta}>
                {item.type === 'public' ? '🌍 Public' : '🔓 Semi-public'} · {item.memberCount} members
              </Text>
              {item.activeMemberCount > 0 && (
                <Text style={styles.activeText}>{item.activeMemberCount} active now</Text>
              )}
              {item.hasFriend && (
                <Text style={styles.friendText}>A friend is here</Text>
              )}
            </View>
            {myPackIds.has(item.id) && (
              <Text style={{ fontSize: 11, color: hub.textMuted, fontStyle: 'italic' }}>Member</Text>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={{ color: hub.textSecondary, fontSize: 15 }}>No open packs yet</Text>
          </View>
        }
      />

      {/* Pack Preview Sheet */}
      {previewPack && (
        <TouchableWithoutFeedback onPress={closePreview}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      )}
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}
        pointerEvents={previewPack ? 'auto' : 'none'}
      >
        {previewPack && (
          <View style={styles.sheetInner}>
            <TouchableOpacity style={styles.sheetClose} onPress={closePreview}>
              <Text style={{ color: hub.textSecondary, fontWeight: '600' }}>✕</Text>
            </TouchableOpacity>

            {previewPack.photo_url ? (
              <Image source={{ uri: previewPack.photo_url }} style={styles.sheetPhoto} />
            ) : (
              <View style={[styles.sheetPhoto, styles.sheetPhotoPlaceholder]}>
                <Text style={{ fontSize: 36 }}>🐾</Text>
              </View>
            )}
            <Text style={styles.sheetName}>{previewPack.name}</Text>
            <Text style={styles.sheetMeta}>
              {previewPack.type === 'public' ? '🌍 Public' : '🔓 Semi-public'} · {previewPack.memberCount} members
              {previewPack.activeMemberCount > 0 ? ` · ${previewPack.activeMemberCount} active` : ''}
            </Text>

            {previewMembers.length > 0 && (
              <View style={styles.sheetMembers}>
                {previewMembers.map((m) => (
                  <View key={m.dogId ?? m.userId} style={styles.sheetMember}>
                    {m.dogPhoto ? (
                      <Image source={{ uri: m.dogPhoto }} style={styles.sheetMemberPhoto} />
                    ) : (
                      <View style={[styles.sheetMemberPhoto, styles.sheetMemberPhotoPlaceholder]}>
                        <Text style={{ fontSize: 14 }}>🐶</Text>
                      </View>
                    )}
                    <Text style={styles.sheetMemberName} numberOfLines={1}>{m.dogName}</Text>
                    {m.role === 'leader' && <Text style={{ fontSize: 10 }}>🐕</Text>}
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.sheetAction} onPress={() => handleAction(previewPack)} activeOpacity={0.8}>
              <Text style={styles.sheetActionText}>
                {myPackIds.has(previewPack.id) ? 'Open Chat' : previewPack.type === 'public' ? 'Join Pack' : 'Request to Join'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: hub.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: hub.bg },
  list: { padding: 16, gap: 10 },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: hub.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: hub.border,
    gap: 12,
  },
  packPhoto: { width: 56, height: 56, borderRadius: 16 },
  packPhotoPlaceholder: { backgroundColor: hub.border, justifyContent: 'center', alignItems: 'center' },
  packInfo: { flex: 1 },
  packName: { fontSize: 15, fontWeight: '700', color: hub.text },
  packMeta: { fontSize: 12, color: hub.textSecondary, marginTop: 2 },
  activeText: { fontSize: 11, color: hub.amber, marginTop: 2 },
  friendText: { fontSize: 11, color: hub.textMuted, marginTop: 1, fontStyle: 'italic' },
  // Sheet
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 360,
    backgroundColor: hub.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: hub.border,
  },
  sheetInner: { flex: 1, alignItems: 'center', padding: 20, paddingTop: 28 },
  sheetClose: {
    position: 'absolute', top: 12, right: 16,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: hub.bg, justifyContent: 'center', alignItems: 'center',
  },
  sheetPhoto: { width: 72, height: 72, borderRadius: 20, marginBottom: 10 },
  sheetPhotoPlaceholder: { backgroundColor: hub.border, justifyContent: 'center', alignItems: 'center' },
  sheetName: { fontSize: 20, fontWeight: '700', color: hub.text, marginBottom: 4 },
  sheetMeta: { fontSize: 12, color: hub.textSecondary, marginBottom: 16 },
  sheetMembers: { flexDirection: 'row', gap: 14, marginBottom: 20 },
  sheetMember: { alignItems: 'center', width: 52 },
  sheetMemberPhoto: { width: 44, height: 44, borderRadius: 14, marginBottom: 4 },
  sheetMemberPhotoPlaceholder: { backgroundColor: hub.border, justifyContent: 'center', alignItems: 'center' },
  sheetMemberName: { fontSize: 10, color: hub.textSecondary, textAlign: 'center' },
  sheetAction: { backgroundColor: hub.amber, borderRadius: 20, paddingHorizontal: 28, paddingVertical: 10 },
  sheetActionText: { fontSize: 14, fontWeight: '700', color: hub.bg },
});
