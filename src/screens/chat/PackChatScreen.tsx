import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useDogStore } from '../../store/dogStore';
import { sendPackMessage, getPackMembers, PackMemberInfo, isPackLeader, getPendingRequestCount } from '../../services/packService';
import { supabase } from '../../lib/supabase';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

type Props = {
  route: { params: { packId: string; packName: string; memberCount: number } };
  navigation: any;
};

type PackMessage = {
  id: string;
  sender_id: string;
  sender_dog_id: string | null;
  content: string;
  created_at: string;
};

const AVATAR_SIZE = 32;

export default function PackChatScreen({ route, navigation }: Props) {
  const { packId, packName, memberCount } = route.params;
  const { user } = useAuthStore();
  const { currentDog } = useDogStore();
  const activeDog = currentDog();
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Fetch pack members for dog name/photo lookup
  const { data: members = [] } = useQuery({
    queryKey: ['pack_members', packId],
    queryFn: () => getPackMembers(packId),
  });

  const { data: userIsLeader = false } = useQuery({
    queryKey: ['is_pack_leader', packId, user?.id],
    queryFn: () => isPackLeader(packId, user!.id),
    enabled: !!user,
  });

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['pending_request_count', packId],
    queryFn: () => getPendingRequestCount(packId),
    enabled: !!user && userIsLeader,
    refetchInterval: 15000,
  });

  useEffect(() => {
    navigation.setOptions({
      title: packName,
      headerBackTitle: 'Back',
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: spacing.sm }}>
          {userIsLeader && pendingCount > 0 && (
            <TouchableOpacity
              style={{ backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}
              onPress={() => navigation.navigate('PackRequests', { packId, packName })}
            >
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{pendingCount} pending →</Text>
            </TouchableOpacity>
          )}
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </Text>
        </View>
      ),
    });
  }, [packName, memberCount, userIsLeader, pendingCount]);

  // Build dogId → { name, photo } map
  const memberMap = React.useMemo(() => {
    const map: Record<string, { name: string; photo: string | null }> = {};
    for (const m of members) {
      if (m.dogId) map[m.dogId] = { name: m.dogName, photo: m.dogPhoto };
    }
    return map;
  }, [members]);

  // Fetch messages
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['pack_messages', packId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, sender_dog_id, content, created_at')
        .eq('pack_id', packId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PackMessage[];
    },
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`pack_chat_${packId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `pack_id=eq.${packId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['pack_messages', packId] });
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[PackChatScreen] Realtime error:', err);
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [packId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!input.trim() || !user) return;
    setSending(true);
    const text = input.trim();
    setInput('');
    try {
      await sendPackMessage(packId, user.id, activeDog?.id ?? null, text);
      queryClient.invalidateQueries({ queryKey: ['pack_messages', packId] });
    } catch (e) {
      console.error('[PackChatScreen] sendPackMessage error:', e);
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item, index }: { item: PackMessage; index: number }) => {
    const isOwn = item.sender_id === user?.id;
    const prevItem = index > 0 ? messages[index - 1] : null;
    // Start of a streak: no previous message, or previous was from a different dog
    const isStreakStart =
      !prevItem ||
      (prevItem.sender_dog_id ?? prevItem.sender_id) !== (item.sender_dog_id ?? item.sender_id);

    if (isOwn) {
      return (
        <View style={styles.ownRow}>
          <View style={styles.ownBubble}>
            <Text style={styles.ownText}>{item.content}</Text>
          </View>
        </View>
      );
    }

    const dogInfo = item.sender_dog_id ? memberMap[item.sender_dog_id] : null;

    return (
      <View style={styles.theirRow}>
        {/* Avatar column — always occupies same width for alignment */}
        <View style={styles.avatarCol}>
          {isStreakStart ? (
            dogInfo?.photo ? (
              <Image source={{ uri: dogInfo.photo }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={{ fontSize: 16 }}>🐶</Text>
              </View>
            )
          ) : null}
        </View>
        <View style={styles.theirContent}>
          {isStreakStart && dogInfo && (
            <Text style={styles.senderName}>{dogInfo.name}</Text>
          )}
          <View style={[styles.theirBubble, !isStreakStart && styles.theirBubbleGrouped]}>
            <Text style={styles.theirText}>{item.content}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Be the first to woof 🐾</Text>
            </View>
          }
        />
      )}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Woof something..."
          placeholderTextColor={colors.textSecondary}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { ...typography.body, color: colors.textSecondary },
  messageList: { padding: spacing.md, paddingBottom: spacing.lg },
  ownRow: { alignItems: 'flex-end', marginBottom: 4 },
  ownBubble: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: '75%',
  },
  ownText: { ...typography.body, color: '#fff' },
  theirRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4 },
  avatarCol: {
    width: AVATAR_SIZE + spacing.sm,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginRight: 4,
  },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  theirContent: { flex: 1, maxWidth: '75%' },
  senderName: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: 3, marginLeft: 4 },
  theirBubble: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  theirBubbleGrouped: { borderTopLeftRadius: 16 },
  theirText: { ...typography.body, color: colors.text },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceHigh,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.surfaceHigh },
  sendBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
