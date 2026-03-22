import { supabase } from '../lib/supabase';

export type SearchDogResult = {
  type: 'dog';
  dogId: string;
  dogName: string;
  dogBreed: string | null;
  dogPhoto: string | null;
  ownerId: string;
  ownerName: string;
  isFriend: boolean;
};

export type SearchOwnerResult = {
  type: 'owner';
  ownerId: string;
  ownerName: string;
  ownerPhoto: string | null;
  dogs: { id: string; name: string; breed: string | null; photo: string | null }[];
};

export type SearchBreedResult = {
  type: 'breed';
  breed: string;
  count: number;
  samplePhotos: string[];
  dogIds: string[];
};

export type SearchPackResult = {
  type: 'pack';
  packId: string;
  packName: string;
  memberCount: number;
  packType: 'public' | 'semi_public';
  isMember: boolean;
};

export type SearchResults = {
  dogs: SearchDogResult[];
  owners: SearchOwnerResult[];
  breeds: SearchBreedResult[];
  packs: SearchPackResult[];
};

export async function searchAll(query: string, currentUserId: string, currentDogId?: string | null): Promise<SearchResults> {
  if (query.length < 2) return { dogs: [], owners: [], breeds: [], packs: [] };

  const [{ data: dogsRaw }, { data: ownersRaw }, { data: packsRaw }, { data: myPacks }, { data: myFriendships }] = await Promise.all([
    supabase
      .from('dogs')
      .select('id, name, breed, photo_url, owner:profiles!owner_id(id, name)')
      .or(`name.ilike.%${query}%,breed.ilike.%${query}%`)
      .neq('owner_id', currentUserId)
      .limit(20),
    supabase
      .from('profiles')
      .select('id, name, photo_url')
      .ilike('name', `%${query}%`)
      .neq('id', currentUserId)
      .limit(20),
    supabase
      .from('packs')
      .select('id, name, type, pack_members(count)')
      .ilike('name', `%${query}%`)
      .in('type', ['public', 'semi_public'])
      .limit(20),
    currentDogId
      ? supabase.from('pack_members').select('pack_id').eq('dog_id', currentDogId)
      : Promise.resolve({ data: [] }),
    currentDogId
      ? supabase.from('friendships').select('id, dog_a, dog_b').or(`dog_a.eq.${currentDogId},dog_b.eq.${currentDogId}`)
      : Promise.resolve({ data: [] }),
  ]);

  const friendDogIds = new Set((myFriendships ?? []).flatMap((f: any) => [f.dog_a, f.dog_b]));
  const dogs: SearchDogResult[] = (dogsRaw ?? []).map((d: any) => ({
    type: 'dog',
    dogId: d.id,
    dogName: d.name,
    dogBreed: d.breed ?? null,
    dogPhoto: d.photo_url ?? null,
    ownerId: d.owner?.id ?? '',
    ownerName: d.owner?.name ?? 'Unknown',
    isFriend: friendDogIds.has(d.id),
  }));

  const owners: SearchOwnerResult[] = (ownersRaw ?? []).map((p: any) => ({
    type: 'owner',
    ownerId: p.id,
    ownerName: p.name,
    ownerPhoto: p.photo_url ?? null,
    dogs: (dogsRaw ?? [])
      .filter((d: any) => d.owner?.id === p.id)
      .map((d: any) => ({ id: d.id, name: d.name, breed: d.breed ?? null, photo: d.photo_url ?? null })),
  }));

  // Build breeds from dog results
  const breedMap: Record<string, SearchBreedResult> = {};
  for (const d of dogs) {
    if (!d.dogBreed) continue;
    if (!breedMap[d.dogBreed]) {
      breedMap[d.dogBreed] = { type: 'breed', breed: d.dogBreed, count: 0, samplePhotos: [], dogIds: [] };
    }
    breedMap[d.dogBreed].count++;
    breedMap[d.dogBreed].dogIds.push(d.dogId);
    if (d.dogPhoto && breedMap[d.dogBreed].samplePhotos.length < 3) {
      breedMap[d.dogBreed].samplePhotos.push(d.dogPhoto);
    }
  }
  const breeds = Object.values(breedMap).filter((b) => b.count > 1);

  const myPackIds = new Set((myPacks ?? []).map((m: any) => m.pack_id));
  const packs: SearchPackResult[] = (packsRaw ?? []).map((p: any) => ({
    type: 'pack',
    packId: p.id,
    packName: p.name,
    memberCount: p.pack_members?.[0]?.count ?? 0,
    packType: p.type,
    isMember: myPackIds.has(p.id),
  }));

  return { dogs, owners, breeds, packs };
}
