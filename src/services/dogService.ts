import { supabase } from '../lib/supabase';
import { Dog } from '../types/database.types';

export async function getDogs(ownerId: string): Promise<Dog[]> {
  const { data, error } = await supabase
    .from('dogs')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createDog(
  dog: { owner_id: string; name: string; breed?: string; age_years?: number; bio?: string; photo_url?: string }
): Promise<Dog> {
  const { data, error } = await supabase
    .from('dogs')
    .insert(dog)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDog(
  id: string,
  updates: { name?: string; breed?: string; age_years?: number; bio?: string; photo_url?: string }
): Promise<Dog> {
  const { data, error } = await supabase
    .from('dogs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDog(id: string): Promise<void> {
  const { error } = await supabase.from('dogs').delete().eq('id', id);
  if (error) throw error;
}
