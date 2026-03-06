import * as ExpoLocation from 'expo-location';
import { supabase } from '../lib/supabase';

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentLocation(): Promise<{ lat: number; lng: number } | null> {
  const location = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
  return { lat: location.coords.latitude, lng: location.coords.longitude };
}

export async function upsertLocation(ownerId: string, lat: number, lng: number): Promise<void> {
  const { error } = await supabase.from('locations').upsert({
    owner_id: ownerId,
    lat,
    lng,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export type TripDog = {
  owner_id: string;
  dog_id: string;
  lat: number;
  lng: number;
  dog_name: string;
  dog_photo: string | null;
  dog_breed: string | null;
  dog_age: number | null;
  dog_bio: string | null;
  dog_energy_level: string | null;
  dog_temperament: string[] | null;
  owner_name: string;
  owner_photo: string | null;
};

export async function startTrip(userId: string, dogId: string, lat: number, lng: number): Promise<void> {
  const { error } = await supabase.from('locations').upsert({
    owner_id: userId,
    dog_id: dogId,
    lat,
    lng,
    on_trip: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'owner_id' });
  if (error) throw error;
}

export async function updateTripLocation(userId: string, lat: number, lng: number): Promise<void> {
  const { error } = await supabase
    .from('locations')
    .update({ lat, lng, updated_at: new Date().toISOString() })
    .eq('owner_id', userId);
  if (error) throw error;
}

export async function endTrip(userId: string): Promise<void> {
  const { error } = await supabase
    .from('locations')
    .update({ on_trip: false, updated_at: new Date().toISOString() })
    .eq('owner_id', userId);
  if (error) throw error;
}

export async function fetchActiveTripDogs(currentUserId: string): Promise<TripDog[]> {
  const { data: tripLocations, error } = await supabase
    .from('locations')
    .select('owner_id, dog_id, lat, lng')
    .eq('on_trip', true)
    .neq('owner_id', currentUserId);

  if (error) throw error;
  if (!tripLocations?.length) return [];

  const ownerIds = tripLocations.map((l) => l.owner_id);
  const dogIds = tripLocations.map((l) => l.dog_id).filter(Boolean);

  const [{ data: dogs }, { data: profiles }] = await Promise.all([
    supabase.from('dogs').select('id, name, photo_url, breed, age_years, bio, energy_level, temperament').in('id', dogIds),
    supabase.from('profiles').select('id, name, photo_url').in('id', ownerIds),
  ]);

  return tripLocations.map((loc) => {
    const dog = dogs?.find((d) => d.id === loc.dog_id);
    const profile = profiles?.find((p) => p.id === loc.owner_id);
    return {
      owner_id: loc.owner_id,
      dog_id: loc.dog_id,
      lat: loc.lat,
      lng: loc.lng,
      dog_name: dog?.name ?? 'Unknown Dog',
      dog_photo: dog?.photo_url ?? null,
      dog_breed: dog?.breed ?? null,
      dog_age: dog?.age_years ?? null,
      dog_bio: dog?.bio ?? null,
      dog_energy_level: dog?.energy_level ?? null,
      dog_temperament: dog?.temperament ?? null,
      owner_name: profile?.name ?? 'Unknown',
      owner_photo: profile?.photo_url ?? null,
    };
  });
}

export type IncomingTripLike = {
  request_id: string;
  sender_dog_id: string;
  sender_id: string;
  dog_name: string;
  dog_photo: string | null;
  dog_breed: string | null;
  dog_age: number | null;
  dog_bio: string | null;
  owner_name: string;
  owner_photo: string | null;
};

export async function fetchTripLikeSender(senderDogId: string, senderId: string, requestId: string): Promise<IncomingTripLike | null> {
  const [{ data: dog }, { data: profile }] = await Promise.all([
    supabase.from('dogs').select('id, name, photo_url, breed, age_years, bio').eq('id', senderDogId).single(),
    supabase.from('profiles').select('id, name, photo_url').eq('id', senderId).single(),
  ]);

  if (!dog) return null;
  return {
    request_id: requestId,
    sender_dog_id: senderDogId,
    sender_id: senderId,
    dog_name: dog.name,
    dog_photo: dog.photo_url ?? null,
    dog_breed: dog.breed ?? null,
    dog_age: dog.age_years ?? null,
    dog_bio: dog.bio ?? null,
    owner_name: profile?.name ?? 'Unknown',
    owner_photo: profile?.photo_url ?? null,
  };
}

export type NearbyDogData = {
  id: string;
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

export type NearbyUser = {
  owner_id: string;
  lat: number;
  lng: number;
  profile: {
    name: string;
    photo_url: string | null;
    status: 'active' | 'looking' | 'offline';
    verified: boolean;
    age: number | null;
    occupation: string | null;
    neighborhood: string | null;
    interests: string[] | null;
    bio: string | null;
  };
  dogs: NearbyDogData[];
};

export async function fetchNearbyUsers(currentUserId: string): Promise<NearbyUser[]> {
  // Fetch all locations except current user
  const { data: locations, error } = await supabase
    .from('locations')
    .select('owner_id, lat, lng')
    .neq('owner_id', currentUserId);

  if (error) throw error;
  if (!locations || locations.length === 0) return [];

  const ownerIds = locations.map((l) => l.owner_id);

  // Fetch profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, name, photo_url, status, verified, age, occupation, neighborhood, interests, bio')
    .in('id', ownerIds);
  if (profilesError) throw profilesError;

  // Fetch dogs
  const { data: dogs, error: dogsError } = await supabase
    .from('dogs')
    .select('id, owner_id, name, breed, age_years, photo_url, photos, gender, energy_level, size, temperament, activities, good_with_dogs, good_with_kids, vaccinated, neutered, training_level, bio, prompts')
    .in('owner_id', ownerIds);
  if (dogsError) throw dogsError;

  return locations.map((loc) => ({
    owner_id: loc.owner_id,
    lat: loc.lat,
    lng: loc.lng,
    profile: profiles?.find((p) => p.id === loc.owner_id) ?? { name: 'Unknown', photo_url: null, status: 'offline' as const, verified: false, age: null, occupation: null, neighborhood: null, interests: null, bio: null },
    dogs: dogs?.filter((d) => d.owner_id === loc.owner_id) ?? [],
  }));
}
