import { supabase } from '../lib/supabase';

// Types
export type NeighborhoodPack = {
  id: string;
  name: string;
  type: 'public' | 'semi_public';
  photo_url: string | null;
  memberCount: number;
  activeMemberCount: number;
  hasFriend: boolean;
  memberPhotos: string[];
};

export type TrendingBreed = {
  breed: string;
  count: number;
};

export type NewPawsDog = {
  id: string;
  name: string;
  breed: string | null;
  photo_url: string | null;
  age_years: number | null;
  energy_level: string | null;
  owner_id: string;
  owner_name: string;
  created_at: string;
};

// ─── Neighborhood Highlights ─────────────────────────────────────────────────

export async function getNeighborhoodPacks(currentUserId: string, myDogId?: string | null): Promise<NeighborhoodPack[]> {
  const [{ data, error }, { data: tripUsers }, { data: friendships }] = await Promise.all([
    supabase
      .from('packs')
      .select('id, name, type, photo_url, pack_members(user_id, dog_id, dog:dogs!dog_id(photo_url))')
      .in('type', ['public', 'semi_public'])
      .limit(20),
    supabase
      .from('locations')
      .select('owner_id')
      .eq('on_trip', true),
    myDogId
      ? supabase.from('friendships').select('dog_a, dog_b').or(`dog_a.eq.${myDogId},dog_b.eq.${myDogId}`)
      : Promise.resolve({ data: [] }),
  ]);
  if (error) throw error;

  const activeUserIds = new Set((tripUsers ?? []).map((t: any) => t.owner_id));
  const friendDogIds = new Set((friendships ?? []).flatMap((f: any) => [f.dog_a, f.dog_b]));

  const packs = (data ?? []).map((p: any) => {
    const members = p.pack_members ?? [];
    const activeMemberCount = members.filter((m: any) => activeUserIds.has(m.user_id)).length;
    const hasFriend = members.some((m: any) => m.dog_id && friendDogIds.has(m.dog_id));
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      photo_url: p.photo_url,
      memberCount: members.length,
      activeMemberCount,
      hasFriend,
      memberPhotos: members
        .slice(0, 3)
        .map((m: any) => m.dog?.photo_url)
        .filter(Boolean),
    };
  });

  // Sort: most active first, then friends' packs as tiebreaker
  packs.sort((a, b) => {
    if (b.activeMemberCount !== a.activeMemberCount) return b.activeMemberCount - a.activeMemberCount;
    if (a.hasFriend !== b.hasFriend) return a.hasFriend ? -1 : 1;
    return b.memberCount - a.memberCount;
  });

  return packs.slice(0, 10);
}

// ─── Trending Breeds ─────────────────────────────────────────────────────────

export async function getTrendingBreeds(currentUserId: string): Promise<TrendingBreed[]> {
  const { data, error } = await supabase
    .from('dogs')
    .select('breed')
    .neq('owner_id', currentUserId)
    .not('breed', 'is', null);
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const d of data ?? []) {
    const breed = (d as any).breed;
    if (breed) counts[breed] = (counts[breed] ?? 0) + 1;
  }

  return Object.entries(counts)
    .map(([breed, count]) => ({ breed, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

// ─── New Paws ────────────────────────────────────────────────────────────────

export async function getNewPaws(currentUserId: string): Promise<NewPawsDog[]> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('dogs')
    .select('id, name, breed, photo_url, age_years, energy_level, owner_id, created_at, owner:profiles!owner_id(name)')
    .neq('owner_id', currentUserId)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;

  return (data ?? []).map((d: any) => ({
    id: d.id,
    name: d.name,
    breed: d.breed ?? null,
    photo_url: d.photo_url ?? null,
    age_years: d.age_years ?? null,
    energy_level: d.energy_level ?? null,
    owner_id: d.owner_id,
    owner_name: d.owner?.name ?? 'Unknown',
    created_at: d.created_at,
  }));
}
