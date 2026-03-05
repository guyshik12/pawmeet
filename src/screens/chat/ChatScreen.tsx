import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { getMessages, sendMessage } from '../../services/chatService';
import { supabase } from '../../lib/supabase';
import { Message } from '../../types/database.types';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { format } from 'date-fns';

type Props = {
  route: { params: { friendshipId: string; friendName: string; friendDogName: string } };
  navigation: any;
};

export default function ChatScreen({ route, navigation }: Props) {
  const { friendshipId, friendName, friendDogName } = route.params;
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    navigation.setOptions({ title: friendDogName });
  }, [friendDogName]);

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
  emptyEmoji: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { ...typography.body, color: colors.textSecondary },
  dateLabel: { ...typography.caption, color: colors.textLight, textAlign: 'center', marginVertical: spacing.sm },
  bubble: {
    maxWidth: '75%', borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  bubbleMe: { backgroundColor: colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: colors.surface, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  bubbleText: { ...typography.body },
  bubbleTextMe: { color: colors.surface },
  bubbleTextThem: { color: colors.text },
  bubbleTime: { ...typography.caption, marginTop: 2 },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  bubbleTimeThem: { color: colors.textLight },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: spacing.md, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm,
  },
  input: {
    flex: 1, backgroundColor: colors.background,
    borderRadius: borderRadius.lg, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, ...typography.body, color: colors.text,
    maxHeight: 100, borderWidth: 1, borderColor: colors.border,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.disabled },
  sendBtnText: { color: colors.surface, fontSize: 20, fontWeight: '700' },
});
