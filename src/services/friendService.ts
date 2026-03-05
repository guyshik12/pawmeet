import { supabase } from '../lib/supabase';
import { FriendRequest, Friendship } from '../types/database.types';

export async function sendFriendRequest(senderId: string, receiverId: string): Promise<void> {
  const { error } = await supabase
    .from('friend_requests')
    .insert({ sender_id: senderId, receiver_id: receiverId });
  if (error) throw error;
}

export async function respondToRequest(requestId: string, status: 'accepted' | 'declined'): Promise<void> {
  const { error } = await supabase
    .from('friend_requests')
    .update({ status })
    .eq('id', requestId);
  if (error) throw error;
}

export async function getIncomingRequests(userId: string): Promise<(FriendRequest & {
  sender: { name: string; photo_url: string | null };
  senderDogs: { name: string; photo_url: string | null }[];
})[]> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('receiver_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const senderIds = data.map((r) => r.sender_id);

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, photo_url')
    .in('id', senderIds);

  const { data: dogs } = await supabase
    .from('dogs')
    .select('owner_id, name, photo_url')
    .in('owner_id', senderIds);

  return data.map((req) => ({
    ...req,
    sender: profiles?.find((p) => p.id === req.sender_id) ?? { name: 'Unknown', photo_url: null },
    senderDogs: dogs?.filter((d) => d.owner_id === req.sender_id) ?? [],
  }));
}

export async function getFriends(userId: string): Promise<(Friendship & {
  friendId: string;
  friend: { name: string; photo_url: string | null };
  friendDogs: { id: string; name: string; breed: string | null; photo_url: string | null }[];
})[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const friendIds = data.map((f) => f.user_a === userId ? f.user_b : f.user_a);

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, photo_url')
    .in('id', friendIds);

  const { data: dogs } = await supabase
    .from('dogs')
    .select('id, owner_id, name, breed, photo_url')
    .in('owner_id', friendIds);

  return data.map((f) => {
    const friendId = f.user_a === userId ? f.user_b : f.user_a;
    return {
      ...f,
      friendId,
      friend: profiles?.find((p) => p.id === friendId) ?? { name: 'Unknown', photo_url: null },
      friendDogs: dogs?.filter((d) => d.owner_id === friendId) ?? [],
    };
  });
}

export async function getMyRequestStatuses(userId: string): Promise<Record<string, 'pending' | 'accepted' | 'declined'>> {
  const { data } = await supabase
    .from('friend_requests')
    .select('receiver_id, status')
    .eq('sender_id', userId);
  const result: Record<string, 'pending' | 'accepted' | 'declined'> = {};
  data?.forEach((r) => { result[r.receiver_id] = r.status; });
  return result;
}
