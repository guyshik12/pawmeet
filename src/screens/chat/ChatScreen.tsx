import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Image,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useDogStore } from '../../store/dogStore';
import { useUnreadStore } from '../../store/unreadStore';
import { getMessages, sendMessage } from '../../services/chatService';
import { markFriendshipRead } from '../../services/friendService';
import { supabase } from '../../lib/supabase';
import { setActiveChatFriendshipId } from '../../services/activeChatRef';
import { Message } from '../../types/database.types';
import { colors, spacing, typography, borderRadius, shadow } from '../../constants/theme';
import { format } from 'date-fns';

type Props = {
  route: { params: { friendshipId: string; friendName: string; friendDogName: string; isUserA: boolean } };
  navigation: any;
};

export default function ChatScreen({ route, navigation }: Props) {
  const { friendshipId, friendName, friendDogName, isUserA, friendDog, friendOwner } = route.params as any;
  const { user } = useAuthStore();
  const { currentDog } = useDogStore();
  const activeDog = currentDog();
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const unreadCount = useUnreadStore((s) => s.count);

  useEffect(() => {
    const cacheKey = ['unread_counts', user?.id, (activeDog ? [activeDog.id] : []).join()];
    const cached = queryClient.getQueryData<Record<string, number>>(cacheKey);
    if ((cached?.[friendshipId] ?? 0) > 0) {
      useUnreadStore.getState().decrement();
      queryClient.setQueryData(cacheKey, (old: Record<string, number> | undefined) => {
        if (!old) return {};
        return { ...old, [friendshipId]: 0 };
      });
    }
  }, [friendshipId]);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', marginLeft: -4, gap: 6 }}>
          <Text style={{ fontSize: 40, color: colors.primary, lineHeight: 40 }}>‹</Text>
          {unreadCount > 0 ? (
            <View style={{ backgroundColor: colors.primary, borderRadius: 9, paddingHorizontal: 5, paddingVertical: 1 }}>
              <Text style={{ fontSize: 12, color: '#fff', fontWeight: '700' }}>{unreadCount}</Text>
            </View>
          ) : null}
          {friendDog?.photo_url ? (
            <Image source={{ uri: friendDog.photo_url }} style={{ width: 36, height: 36, borderRadius: 10 }} />
          ) : (
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surfaceHigh, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 18 }}>🐶</Text>
            </View>
          )}
        </TouchableOpacity>
      ),
      headerTitle: () => (
        <TouchableOpacity
          onPress={friendDog ? () => navigation.navigate('FriendProfile', {
            dog: friendDog,
            ownerProfile: friendOwner,
            ownerId: friendDog.owner_id,
            friendshipId,
            isUserA,
            friendName,
          }) : undefined}
          activeOpacity={friendDog ? 0.7 : 1}
        >
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>{friendDogName}</Text>
        </TouchableOpacity>
      ),
    });
  }, [friendDogName, unreadCount]);

  // Tell AppTabs we're in this chat so it won't show a banner for its messages
  useEffect(() => {
    setActiveChatFriendshipId(friendshipId);
    return () => setActiveChatFriendshipId(null);
  }, [friendshipId]);

  // Mark as read when screen opens
  useEffect(() => {
    if (user) {
      markFriendshipRead(friendshipId, user.id, isUserA).then(() => {
        queryClient.invalidateQueries({ queryKey: ['badge_count'] });
        // Don't invalidate unread_counts or unread_conversation_count here —
        // the optimistic update already handled them instantly on mount
      });
    }
  }, [friendshipId, user?.id]);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', friendshipId],
    queryFn: () => getMessages(friendshipId),
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`chat_${friendshipId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `friendship_id=eq.${friendshipId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['messages', friendshipId] });
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[ChatScreen] Realtime channel error — Supabase will retry:', err);
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [friendshipId]);

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
      await sendMessage(friendshipId, user.id, text);
      queryClient.invalidateQueries({ queryKey: ['messages', friendshipId] });
    } catch (e: any) {
      setInput(text);
      Alert.alert('Failed to send', 'Message could not be sent. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.messagesList}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🐾</Text>
            <Text style={styles.emptyText}>Say hello to {friendDogName}!</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const isMe = item.sender_id === user?.id;
          const showDate = index === 0 ||
            new Date(item.created_at).toDateString() !== new Date(messages[index - 1].created_at).toDateString();
          return (
            <>
              {showDate && (
                <Text style={styles.dateLabel}>
                  {format(new Date(item.created_at), 'MMM d')}
                </Text>
              )}
              <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
                  {item.content}
                </Text>
                <Text style={[styles.bubbleTime, isMe ? styles.bubbleTimeMe : styles.bubbleTimeThem]}>
                  {format(new Date(item.created_at), 'HH:mm')}
                </Text>
              </View>
            </>
          );
        }}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={`Message ${friendDogName}…`}
          placeholderTextColor={colors.textLight}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={handleSend}
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
  messagesList: { padding: spacing.md, paddingBottom: spacing.lg, flexGrow: 1, justifyContent: 'flex-end' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: spacing.xxl },
  emptyEmoji: { fontSize: 56, marginBottom: spacing.sm },
  emptyText: { ...typography.body, color: colors.textSecondary },
  dateLabel: {
    ...typography.caption, color: colors.textLight, textAlign: 'center',
    marginVertical: spacing.sm, fontWeight: '700',
  },
  bubble: {
    maxWidth: '78%', borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  bubbleMe: {
    backgroundColor: colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 6,
    ...shadow.sm,
  },
  bubbleThem: {
    backgroundColor: colors.surfaceHigh, alignSelf: 'flex-start', borderBottomLeftRadius: 6,
    borderWidth: 1.5, borderColor: colors.border,
  },
  bubbleText: { ...typography.body, lineHeight: 22 },
  bubbleTextMe: { color: colors.background },
  bubbleTextThem: { color: colors.text },
  bubbleTime: { ...typography.caption, marginTop: 3 },
  bubbleTimeMe: { color: 'rgba(0,0,0,0.5)', textAlign: 'right' },
  bubbleTimeThem: { color: colors.textLight },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1.5, borderTopColor: colors.border, gap: spacing.sm,
  },
  input: {
    flex: 1, backgroundColor: colors.background,
    borderRadius: borderRadius.xl, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2, ...typography.body, color: colors.text,
    maxHeight: 100, borderWidth: 1.5, borderColor: colors.border,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    ...shadow.md,
  },
  sendBtnDisabled: { backgroundColor: colors.disabled, shadowOpacity: 0 },
  sendBtnText: { color: colors.background, fontSize: 22, fontWeight: '800' },
});
