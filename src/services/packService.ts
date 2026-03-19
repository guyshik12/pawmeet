import { supabase } from '../lib/supabase';

export type Pack = {
  id: string;
  name: string;
  type: 'public' | 'semi_public' | 'private';
  created_by: string;
  created_at: string;
};

export type PackMemberInfo = {
  userId: string;
  dogId: string | null;
  dogName: string;
  dogPhoto: string | null;
};

export type PackWithMembers = Pack & {
  members: PackMemberInfo[];
};

export async function getPacks(userId: string): Promise<PackWithMembers[]> {
  const { data, error } = await supabase
    .from('pack_members')
    .select(`
      pack:packs!pack_id(id, name, type, created_by, created_at),
      user_id, dog_id,
      dog:dogs!dog_id(name, photo_url)
    `)
    .eq('user_id', userId);
  if (error) throw error;
  if (!data?.length) return [];

  // Group by pack
  const packMap: Record<string, PackWithMembers> = {};
  for (const row of data as any[]) {
    const pack = row.pack;
    if (!pack) continue;
    if (!packMap[pack.id]) {
      packMap[pack.id] = { ...pack, members: [] };
    }
    // Fetch all members for this pack (will be loaded separately)
  }

  // For each pack, fetch all members
  const packIds = Object.keys(packMap);
  if (!packIds.length) return [];

  const { data: allMembers } = await supabase
    .from('pack_members')
    .select('pack_id, user_id, dog_id, dog:dogs!dog_id(name, photo_url)')
    .in('pack_id', packIds);

  for (const m of (allMembers ?? []) as any[]) {
    if (packMap[m.pack_id]) {
      packMap[m.pack_id].members.push({
        userId: m.user_id,
        dogId: m.dog_id ?? null,
        dogName: m.dog?.name ?? 'Unknown',
        dogPhoto: m.dog?.photo_url ?? null,
      });
    }
  }

  return Object.values(packMap);
}

export async function createPack(
  name: string,
  creatorUserId: string,
  creatorDogId: string | null,
  type: 'public' | 'semi_public' | 'private',
  invitedFriends: { userId: string; dogId: string | null }[],
): Promise<Pack> {
  const { data: pack, error } = await supabase
    .from('packs')
    .insert({ name, created_by: creatorUserId, type })
    .select()
    .single();
  if (error) throw error;

  // Add creator + all invited friends as members
  const members = [
    { pack_id: pack.id, user_id: creatorUserId, dog_id: creatorDogId },
    ...invitedFriends.map((f) => ({ pack_id: pack.id, user_id: f.userId, dog_id: f.dogId })),
  ];
  const { error: membersError } = await supabase.from('pack_members').insert(members);
  if (membersError) throw membersError;

  return pack;
}

export async function sendPackMessage(
  packId: string,
  senderId: string,
  senderDogId: string | null,
  content: string,
): Promise<void> {
  const { error } = await supabase.from('messages').insert({
    pack_id: packId,
    sender_id: senderId,
    sender_dog_id: senderDogId,
    content,
  });
  if (error) throw error;
}

export async function joinPack(
  packId: string,
  userId: string,
  dogId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('pack_members')
    .insert({ pack_id: packId, user_id: userId, dog_id: dogId });
  if (error) throw error;
}

export async function createJoinRequest(
  packId: string,
  userId: string,
  dogId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('pack_join_requests')
    .insert({ pack_id: packId, user_id: userId, dog_id: dogId });
  if (error) throw error;
}

export async function getPackMembers(packId: string): Promise<PackMemberInfo[]> {
  const { data, error } = await supabase
    .from('pack_members')
    .select('user_id, dog_id, dog:dogs!dog_id(name, photo_url)')
    .eq('pack_id', packId);
  if (error) throw error;
  return (data ?? []).map((m: any) => ({
    userId: m.user_id,
    dogId: m.dog_id ?? null,
    dogName: m.dog?.name ?? 'Unknown',
    dogPhoto: m.dog?.photo_url ?? null,
  }));
}
