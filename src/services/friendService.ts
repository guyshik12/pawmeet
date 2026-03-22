import { supabase } from '../lib/supabase';
import { FriendRequest, Friendship } from '../types/database.types';

export async function sendFriendRequest(senderDogId: string, receiverDogId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Fetch receiver dog's owner so we can populate receiver_id for RLS
  const { data: receiverDog } = await supabase
    .from('dogs')
    .select('owner_id')
    .eq('id', receiverDogId)
    .single();

  const { error } = await supabase
    .from('friend_requests')
    .insert({
      sender_dog_id: senderDogId,
      receiver_dog_id: receiverDogId,
      sender_id: user.id,
      receiver_id: receiverDog?.owner_id,
    });
  if (error) throw error;
}

export async function respondToRequest(requestId: string, status: 'accepted' | 'declined'): Promise<void> {
  const { data: req, error: updateErr } = await supabase
    .from('friend_requests')
    .update({ status })
    .eq('id', requestId)
    .select('sender_dog_id, receiver_dog_id')
    .single();
  if (updateErr) throw updateErr;

  if (status !== 'accepted') return;
  if (!req?.sender_dog_id || !req?.receiver_dog_id) {
    throw new Error('Request is missing dog IDs — please re-send the request');
  }

  const { data: dogs, error: dogsErr } = await supabase
    .from('dogs')
    .select('id, owner_id')
    .in('id', [req.sender_dog_id, req.receiver_dog_id]);
  if (dogsErr) throw dogsErr;

  const senderDog = dogs?.find((d) => d.id === req.sender_dog_id);
  const receiverDog = dogs?.find((d) => d.id === req.receiver_dog_id);
  if (!senderDog || !receiverDog) throw new Error('Could not resolve dogs for this request');

  // Check if a friendship row already exists for this specific dog pair
  const { data: ex1 } = await supabase
    .from('friendships').select('id')
    .eq('dog_a', req.sender_dog_id).eq('dog_b', req.receiver_dog_id)
    .maybeSingle();

  const { data: ex2 } = await supabase
    .from('friendships').select('id')
    .eq('dog_a', req.receiver_dog_id).eq('dog_b', req.sender_dog_id)
    .maybeSingle();

  const existing = ex1 ?? ex2;

  if (existing) {
    const { error } = await supabase
      .from('friendships')
      .update({ dog_a: req.sender_dog_id, dog_b: req.receiver_dog_id })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('friendships').insert({
      dog_a: req.sender_dog_id,
      dog_b: req.receiver_dog_id,
      user_a: senderDog.owner_id,
      user_b: receiverDog.owner_id,
    });
    if (error) throw error;
  }
}

export type IncomingRequest = FriendRequest & {
  senderDog: { id: string; name: string; breed: string | null; photo_url: string | null };
  senderOwner: { name: string };
  receiverDogId: string;
};

export async function getIncomingRequests(myDogIds: string[]): Promise<IncomingRequest[]> {
  if (!myDogIds.length) return [];

  const { data, error } = await supabase
    .from('friend_requests')
    .select(`
      *,
      senderDog:dogs!sender_dog_id(id, name, breed, photo_url, owner:profiles!owner_id(id, name))
    `)
    .in('receiver_dog_id', myDogIds)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!data?.length) return [];

  return data.map((req: any) => ({
    ...req,
    senderDog: req.senderDog
      ? { id: req.senderDog.id, name: req.senderDog.name, breed: req.senderDog.breed, photo_url: req.senderDog.photo_url }
      : { id: '', name: 'Unknown', breed: null, photo_url: null },
    senderOwner: req.senderDog?.owner ?? { name: 'Unknown' },
    receiverDogId: req.receiver_dog_id ?? '',
  }));
}

export type FriendDogProfile = {
  id: string;
  owner_id: string;
  name: string;
  breed: string | null;
  age_years: number | null;
  photo_url: string | null;
  photos: string[] | null;
  gender: 'Male' | 'Female' | null;
  energy_level: 'Puppy' | 'High Energy' | 'Medium Energy' | 'Low Energy' | 'Senior' | null;
  size: 'Toy' | 'Small' | 'Medium' | 'Large' | 'Giant' | null;
  temperament: string[] | null;
  activities: string[] | null;
  good_with_dogs: 'Yes' | 'No' | 'Depends' | null;
  good_with_kids: 'Yes' | 'No' | 'Depends' | null;
  vaccinated: boolean | null;
  neutered: boolean | null;
  training_level: 'Untrained' | 'Basic' | 'Well-trained' | 'Professional' | null;
  bio: string | null;
  prompts: { question: string; answer: string }[] | null;
};

export type FriendOwnerProfile = {
  name: string;
  photo_url: string | null;
  verified: boolean;
  status: 'active' | 'looking' | 'offline';
  age: number | null;
  occupation: string | null;
  neighborhood: string | null;
  interests: string[] | null;
  bio: string | null;
};

export type DogFriendship = Friendship & {
  myDogId: string;
  friendDog: FriendDogProfile;
  friendOwner: FriendOwnerProfile;
};

export async function getFriends(myDogIds: string[]): Promise<DogFriendship[]> {
  if (!myDogIds.length) return [];

  const idList = myDogIds.join(',');
  const { data, error } = await supabase
    .from('friendships')
    .select(`
      id, dog_a, dog_b, user_a, user_b, user_a_last_read, user_b_last_read,
      dogAInfo:dogs!dog_a(id, owner_id, name, breed, age_years, photo_url, photos, gender, energy_level, size, temperament, activities, good_with_dogs, good_with_kids, vaccinated, neutered, training_level, bio, prompts, owner:profiles!owner_id(id, name, photo_url, verified, status, age, occupation, neighborhood, interests, bio)),
      dogBInfo:dogs!dog_b(id, owner_id, name, breed, age_years, photo_url, photos, gender, energy_level, size, temperament, activities, good_with_dogs, good_with_kids, vaccinated, neutered, training_level, bio, prompts, owner:profiles!owner_id(id, name, photo_url, verified, status, age, occupation, neighborhood, interests, bio))
    `)
    .or(`dog_a.in.(${idList}),dog_b.in.(${idList})`);
  if (error) throw error;
  if (!data?.length) return [];

  return (data as any[]).map((f) => {
    const myDogId = myDogIds.includes(f.dog_a ?? '') ? (f.dog_a ?? '') : (f.dog_b ?? '');
    const iAmA = myDogId === f.dog_a;
    const friendDogRaw = iAmA ? f.dogBInfo : f.dogAInfo;
    const friendOwnerRaw = friendDogRaw?.owner;
    return {
      ...f,
      myDogId,
      friendDog: friendDogRaw
        ? {
            id: friendDogRaw.id, owner_id: friendDogRaw.owner_id, name: friendDogRaw.name,
            breed: friendDogRaw.breed, age_years: friendDogRaw.age_years ?? null,
            photo_url: friendDogRaw.photo_url, photos: friendDogRaw.photos ?? null,
            gender: friendDogRaw.gender ?? null, energy_level: friendDogRaw.energy_level ?? null,
            size: friendDogRaw.size ?? null, temperament: friendDogRaw.temperament ?? null,
            activities: friendDogRaw.activities ?? null, good_with_dogs: friendDogRaw.good_with_dogs ?? null,
            good_with_kids: friendDogRaw.good_with_kids ?? null, vaccinated: friendDogRaw.vaccinated ?? null,
            neutered: friendDogRaw.neutered ?? null, training_level: friendDogRaw.training_level ?? null,
            bio: friendDogRaw.bio ?? null, prompts: friendDogRaw.prompts ?? null,
          }
        : { id: '', owner_id: '', name: 'Unknown', breed: null, age_years: null, photo_url: null, photos: null, gender: null, energy_level: null, size: null, temperament: null, activities: null, good_with_dogs: null, good_with_kids: null, vaccinated: null, neutered: null, training_level: null, bio: null, prompts: null },
      friendOwner: friendOwnerRaw
        ? {
            name: friendOwnerRaw.name, verified: friendOwnerRaw.verified ?? false,
            status: (friendOwnerRaw.status ?? 'offline') as 'active' | 'looking' | 'offline',
            photo_url: friendOwnerRaw.photo_url ?? null, age: friendOwnerRaw.age ?? null,
            occupation: friendOwnerRaw.occupation ?? null, neighborhood: friendOwnerRaw.neighborhood ?? null,
            interests: friendOwnerRaw.interests ?? null, bio: friendOwnerRaw.bio ?? null,
          }
        : { name: 'Unknown', verified: false, status: 'offline' as const, photo_url: null, age: null, occupation: null, neighborhood: null, interests: null, bio: null },
    };
  });
}

export async function getPendingRequestCount(myDogIds: string[]): Promise<number> {
  if (!myDogIds.length) return 0;
  const { count } = await supabase
    .from('friend_requests')
    .select('*', { count: 'exact', head: true })
    .in('receiver_dog_id', myDogIds)
    .eq('status', 'pending');
  return count ?? 0;
}

export async function markFriendshipRead(friendshipId: string, userId: string, isUserA: boolean): Promise<void> {
  const col = isUserA ? 'user_a_last_read' : 'user_b_last_read';
  await supabase
    .from('friendships')
    .update({ [col]: new Date().toISOString() })
    .eq('id', friendshipId);
}

export async function getUnreadCountsPerFriendship(
  friendships: DogFriendship[],
  userId: string
): Promise<Record<string, number>> {
  if (!friendships.length) return {};

  // Find the oldest per-user read cutoff so we can filter server-side
  const cutoffs = friendships.map((f) => {
    const isA = f.user_a === userId;
    return isA ? (f.user_a_last_read ?? '1970-01-01') : (f.user_b_last_read ?? '1970-01-01');
  });
  const oldestCutoff = cutoffs.reduce((min, c) => (c < min ? c : min), cutoffs[0]);

  // Single query — only fetch messages newer than the oldest read marker
  const { data: messages } = await supabase
    .from('messages')
    .select('friendship_id, created_at')
    .in('friendship_id', friendships.map((f) => f.id))
    .neq('sender_id', userId)
    .gte('created_at', oldestCutoff)
    .limit(500);

  const result: Record<string, number> = {};
  for (const f of friendships) {
    const isA = f.user_a === userId;
    const cutoff = new Date(isA ? f.user_a_last_read ?? '1970-01-01' : f.user_b_last_read ?? '1970-01-01');
    result[f.id] = (messages ?? []).filter(
      (m) => m.friendship_id === f.id && new Date(m.created_at) > cutoff
    ).length;
  }
  return result;
}

export async function getUnreadMessageCount(friendships: DogFriendship[], userId: string): Promise<number> {
  const counts = await getUnreadCountsPerFriendship(friendships, userId);
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

export async function getTotalBadgeCount(myDogId: string | null, userId: string): Promise<number> {
  if (!myDogId) return 0;
  const friends = await getFriends([myDogId]);
  return getUnreadMessageCount(friends, userId);
}

/**
 * Sends a like from senderDog → receiverDog.
 * Uses the server-side RPC to insert the like and attempt friendship creation,
 * then independently verifies whether a friendship now exists so the result
 * is reliable regardless of what format the RPC returns.
 */
export async function handleDogLike(
  senderDogId: string,
  receiverDogId: string,
  senderId: string,
  receiverId: string,
): Promise<{ matched: boolean; friendshipId?: string; isUserA?: boolean }> {
  // Insert our like.
  const { error: insertErr } = await supabase.from('friend_requests').insert({
    sender_dog_id: senderDogId,
    receiver_dog_id: receiverDogId,
    sender_id: senderId,
    receiver_id: receiverId,
    status: 'pending',
  });
  if (insertErr && !insertErr.message.includes('duplicate') && !insertErr.message.includes('unique')) {
    throw insertErr;
  }

  // Check if a DB trigger auto-created the friendship already.
  const { data: fa } = await supabase.from('friendships').select('id, user_a')
    .eq('dog_a', senderDogId).eq('dog_b', receiverDogId).maybeSingle();
  const { data: fb } = !fa ? await supabase.from('friendships').select('id, user_a')
    .eq('dog_a', receiverDogId).eq('dog_b', senderDogId).maybeSingle() : { data: null };
  const auto = fa ?? fb;
  if (auto) return { matched: true, friendshipId: auto.id, isUserA: auto.user_a === senderId };

  // No auto-friendship — check if the other dog already liked us back.
  const { data: reverseRequest } = await supabase
    .from('friend_requests')
    .select('id')
    .eq('sender_dog_id', receiverDogId)
    .eq('receiver_dog_id', senderDogId)
    .maybeSingle();
  if (!reverseRequest) return { matched: false };

  // One final check — the DB trigger may have created the friendship while we were checking.
  const { data: fc } = await supabase.from('friendships').select('id, user_a')
    .eq('dog_a', senderDogId).eq('dog_b', receiverDogId).maybeSingle();
  const { data: fd } = !fc ? await supabase.from('friendships').select('id, user_a')
    .eq('dog_a', receiverDogId).eq('dog_b', senderDogId).maybeSingle() : { data: null };
  const preExisting = fc ?? fd;
  if (preExisting) return { matched: true, friendshipId: preExisting.id, isUserA: preExisting.user_a === senderId };

  // Mutual like confirmed — create friendship ourselves.
  const { data: created, error: friendError } = await supabase
    .from('friendships')
    .insert({ dog_a: senderDogId, dog_b: receiverDogId, user_a: senderId, user_b: receiverId })
    .select('id')
    .single();

  // If DB trigger raced us and already created the friendship, fetch it instead of throwing.
  if (friendError) {
    if (friendError.message.includes('duplicate') || friendError.message.includes('unique')) {
      const { data: fa2 } = await supabase.from('friendships').select('id, user_a')
        .eq('dog_a', senderDogId).eq('dog_b', receiverDogId).maybeSingle();
      const { data: fb2 } = !fa2 ? await supabase.from('friendships').select('id, user_a')
        .eq('dog_a', receiverDogId).eq('dog_b', senderDogId).maybeSingle() : { data: null };
      const existing = fa2 ?? fb2;
      if (existing) return { matched: true, friendshipId: existing.id, isUserA: existing.user_a === senderId };
    }
    throw friendError;
  }

  return { matched: true, friendshipId: created?.id, isUserA: true };
}

export async function unfriendship(friendshipId: string): Promise<void> {
  // Chain .select() so Supabase returns the deleted rows.
  // If RLS silently blocks the delete, data will be empty and we can surface a real error.
  const { data, error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId)
    .select('id, dog_a, dog_b');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Could not remove park pal — make sure you have permission.');
  }

  // Clean up friend_requests so re-liking works in Discover (two separate deletes — nested .or() is broken in Supabase JS).
  const { dog_a, dog_b } = data[0];
  await supabase.from('friend_requests').delete()
    .eq('sender_dog_id', dog_a).eq('receiver_dog_id', dog_b);
  await supabase.from('friend_requests').delete()
    .eq('sender_dog_id', dog_b).eq('receiver_dog_id', dog_a);
}

/** Returns a map of receiverDogId → status for requests sent from any of my dogs */
export async function getMyRequestStatuses(myDogIds: string[]): Promise<Record<string, 'pending' | 'accepted' | 'declined'>> {
  if (!myDogIds.length) return {};
  const { data } = await supabase
    .from('friend_requests')
    .select('receiver_dog_id, status')
    .in('sender_dog_id', myDogIds);
  const result: Record<string, 'pending' | 'accepted' | 'declined'> = {};
  data?.forEach((r) => {
    if (r.receiver_dog_id) result[r.receiver_dog_id] = r.status;
  });
  return result;
}
