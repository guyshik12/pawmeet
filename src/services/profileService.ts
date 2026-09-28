import { supabase } from '../lib/supabase';
import { Profile } from '../types/database.types';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Loads the user's profile, creating one if it doesn't exist yet.
 *
 * This is the entry point used by RootNavigator on every auth state change.
 * Returning here even after a failed insert keeps the user from being stuck
 * in a "logged in but no profile" state — which used to happen when the
 * Register screen tried to insert the profile before the session existed.
 */
export async function getOrCreateProfile(
  userId: string,
  fallbackName?: string
): Promise<Profile | null> {
  const existing = await getProfile(userId);
  if (existing) return existing;

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({ id: userId, name: fallbackName ?? 'Friend' })
    .select()
    .single();
  if (insertError) throw insertError;
  return created;
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
