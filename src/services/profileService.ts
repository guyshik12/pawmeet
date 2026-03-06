import { supabase } from '../lib/supabase';
import { Profile } from '../types/database.types';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateStatus(
  userId: string,
  status: 'active' | 'looking' | 'offline'
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ status })
    .eq('id', userId);
  if (error) throw error;
}

export async function updateProfile(
  userId: string,
  updates: {
    name?: string;
    bio?: string;
    photo_url?: string;
    age?: number | null;
    occupation?: string | null;
    neighborhood?: string | null;
    interests?: string[] | null;
  }
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
