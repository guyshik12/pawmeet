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

type DogFields = {
  name?: string;
  gender?: 'Male' | 'Female' | null;
  photos?: string[] | null;
  breed?: string | null;
  age_years?: number | null;
  bio?: string | null;
  photo_url?: string | null;
  energy_level?: 'Puppy' | 'High Energy' | 'Medium Energy' | 'Low Energy' | 'Senior' | null;
  size?: 'Toy' | 'Small' | 'Medium' | 'Large' | 'Giant' | null;
  temperament?: string[] | null;
  vaccinated?: boolean | null;
  neutered?: boolean | null;
  good_with_dogs?: 'Yes' | 'No' | 'Depends' | null;
  good_with_kids?: 'Yes' | 'No' | 'Depends' | null;
  activities?: string[] | null;
  training_level?: 'Untrained' | 'Basic' | 'Well-trained' | 'Professional' | null;
  prompts?: { question: string; answer: string }[] | null;
};

export async function createDog(
  dog: { owner_id: string } & DogFields
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
  updates: DogFields
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
