import { supabase } from '../lib/supabase';

export type Pack = {
  id: string;
  name: string;
  type: 'public' | 'semi_public' | 'private';
  photo_url: string | null;
  created_by: string;
  created_at: string;
};

export type PackMemberInfo = {
  userId: string;
  dogId: string | null;
  dogName: string;
  dogPhoto: string | null;
};

export type PackMemberWithRole = PackMemberInfo & {
  role: 'leader' | 'member';
};

export type PendingRequest = {
  id: string;
  packId: string;
  userId: string;
  dogId: string | null;
  dogName: string;
  dogPhoto: string | null;
  ownerName: string;
  createdAt: string;
};

export type PackWithMembers = Pack & {
  members: PackMemberInfo[];
};

export async function getPacks(dogId: string): Promise<PackWithMembers[]> {
  const { data, error } = await supabase
    .from('pack_members')
    .select(`
      pack:packs!pack_id(id, name, type, photo_url, created_by, created_at),
      user_id, dog_id,
      dog:dogs!dog_id(name, photo_url)
    `)
    .eq('dog_id', dogId);
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
    { pack_id: pack.id, user_id: creatorUserId, dog_id: creatorDogId, role: 'leader' },
    ...invitedFriends.map((f) => ({ pack_id: pack.id, user_id: f.userId, dog_id: f.dogId, role: 'member' })),
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
    .upsert({ pack_id: packId, user_id: userId, dog_id: dogId }, { onConflict: 'pack_id,dog_id' });
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

export async function getPackMembersWithRoles(packId: string): Promise<PackMemberWithRole[]> {
  const { data, error } = await supabase
    .from('pack_members')
    .select('user_id, dog_id, role, dog:dogs!dog_id(name, photo_url)')
    .eq('pack_id', packId);
  if (error) throw error;
  return (data ?? []).map((m: any) => ({
    userId: m.user_id,
    dogId: m.dog_id ?? null,
    dogName: m.dog?.name ?? 'Unknown',
    dogPhoto: m.dog?.photo_url ?? null,
    role: m.role ?? 'member',
  }));
}

export async function isPackLeader(packId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('pack_members')
    .select('role')
    .eq('pack_id', packId)
    .eq('user_id', userId)
    .single();
  if (error) return false;
  return data?.role === 'leader';
}

export async function getPendingRequests(packId: string): Promise<PendingRequest[]> {
  const { data, error } = await supabase
    .from('pack_join_requests')
    .select('id, pack_id, user_id, dog_id, created_at, dog:dogs!dog_id(name, photo_url)')
    .eq('pack_id', packId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;

  // Fetch owner names separately — no FK from pack_join_requests to profiles
  const userIds = (data ?? []).map((r: any) => r.user_id).filter(Boolean);
  const ownerMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', userIds);
    for (const p of profiles ?? []) {
      ownerMap[(p as any).id] = (p as any).name;
    }
  }

  return (data ?? []).map((r: any) => ({
    id: r.id,
    packId: r.pack_id,
    userId: r.user_id,
    dogId: r.dog_id ?? null,
    dogName: r.dog?.name ?? 'Unknown',
    dogPhoto: r.dog?.photo_url ?? null,
    ownerName: ownerMap[r.user_id] ?? 'Unknown',
    createdAt: r.created_at,
  }));
}

export async function getPendingRequestCount(packId: string): Promise<number> {
  const { count, error } = await supabase
    .from('pack_join_requests')
    .select('id', { count: 'exact', head: true })
    .eq('pack_id', packId)
    .eq('status', 'pending');
  if (error) return 0;
  return count ?? 0;
}

export async function approveJoinRequest(
  requestId: string,
  packId: string,
  userId: string,
  dogId: string | null,
  dogName: string,
  actorUserId: string,
): Promise<void> {
  // Check if dog is already a member
  const { data: existing } = await supabase
    .from('pack_members')
    .select('dog_id')
    .eq('pack_id', packId)
    .eq('dog_id', dogId)
    .maybeSingle();

  if (!existing) {
    const { error: memberError } = await supabase
      .from('pack_members')
      .insert({ pack_id: packId, user_id: userId, dog_id: dogId, role: 'member' });
    if (memberError) throw memberError;
  }

  await supabase
    .from('pack_join_requests')
    .update({ status: 'approved' })
    .eq('id', requestId);

  await postSystemMessage(packId, actorUserId, `🐕 ${dogName} joined the pack`);

  try {
    await supabase.functions.invoke('send-push', {
      body: { type: 'pack_approval', userId, packId },
    });
  } catch (e) {
    console.warn('[approveJoinRequest] push notification failed:', e);
  }
}

export async function dismissJoinRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('pack_join_requests')
    .delete()
    .eq('id', requestId);
  if (error) throw error;
}

export async function updateMemberRole(
  packId: string,
  userId: string,
  role: 'leader' | 'member',
): Promise<void> {
  const { error } = await supabase
    .from('pack_members')
    .update({ role })
    .eq('pack_id', packId)
    .eq('user_id', userId);
  if (error) throw error;
}

async function postSystemMessage(packId: string, actorUserId: string, content: string): Promise<void> {
  try {
    await supabase.from('messages').insert({
      pack_id: packId,
      sender_id: actorUserId,
      content,
      type: 'system',
    });
  } catch (e) {
    console.warn('[packService] system message failed:', e);
  }
}

export async function removeMember(packId: string, userId: string, dogName: string, actorUserId: string): Promise<void> {
  const { error } = await supabase
    .from('pack_members')
    .delete()
    .eq('pack_id', packId)
    .eq('user_id', userId);
  if (error) throw error;
  await postSystemMessage(packId, actorUserId, `🐕 ${dogName} was removed from the pack`);
}

export async function addMemberToPack(
  packId: string,
  userId: string,
  dogId: string | null,
  dogName: string,
  actorUserId: string,
): Promise<void> {
  const { error } = await supabase
    .from('pack_members')
    .insert({ pack_id: packId, user_id: userId, dog_id: dogId, role: 'member' });
  if (error) throw error;
  await postSystemMessage(packId, actorUserId, `🐕 ${dogName} joined the pack`);
}

export async function updatePackPhoto(packId: string, photoUri: string): Promise<string> {
  const fileName = `pack_${packId}_${Date.now()}.jpg`;

  // React Native: fetch file as ArrayBuffer for Supabase storage upload
  const response = await fetch(photoUri);
  const arrayBuffer = await response.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('pack-photos')
    .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('pack-photos')
    .getPublicUrl(fileName);

  const publicUrl = urlData.publicUrl;
  const { error: updateError } = await supabase
    .from('packs')
    .update({ photo_url: publicUrl })
    .eq('id', packId);
  if (updateError) throw updateError;

  return publicUrl;
}
