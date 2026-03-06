import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { getMessages, sendMessage } from '../../services/chatService';
import { markFriendshipRead } from '../../services/friendService';
import { supabase } from '../../lib/supabase';
import { Message } from '../../types/database.types';
import { colors, spacing, typography, borderRadius, shadow } from '../../constants/theme';
import { format } from 'date-fns';

type Props = {
  route: { params: { friendshipId: string; friendName: string; friendDogName: string; isUserA: boolean } };
  navigation: any;
};

export default function ChatScreen({ route, navigation }: Props) {
  const { friendshipId, friendName, friendDogName, isUserA } = route.params;
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    navigation.setOptions({ title: friendDogName });
  }, [friendDogName]);

  // Mark as read when screen opens
  useEffect(() => {
    if (user) {
      markFriendshipRead(friendshipId, user.id, isUserA).then(() => {
        queryClient.invalidateQueries({ queryKey: ['badge_count'] });
        queryClient.invalidateQueries({ queryKey: ['unread_counts'] });
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
      .subscribe();
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
