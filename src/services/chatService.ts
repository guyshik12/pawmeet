import { supabase } from '../lib/supabase';
import { Message } from '../types/database.types';

export async function getMessages(friendshipId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('friendship_id', friendshipId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(friendshipId: string, senderId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .insert({ friendship_id: friendshipId, sender_id: senderId, content });
  if (error) throw error;
}
