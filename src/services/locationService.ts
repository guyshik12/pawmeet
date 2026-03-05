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

export type NearbyUser = {
  owner_id: string;
  lat: number;
  lng: number;
  profile: { name: string; photo_url: string | null };
  dogs: { id: string; name: string; breed: string | null; age_years: number | null; photo_url: string | null }[];
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
    .select('id, name, photo_url')
    .in('id', ownerIds);
  if (profilesError) throw profilesError;

  // Fetch dogs
  const { data: dogs, error: dogsError } = await supabase
    .from('dogs')
    .select('id, owner_id, name, breed, age_years, photo_url')
    .in('owner_id', ownerIds);
  if (dogsError) throw dogsError;

  return locations.map((loc) => ({
    owner_id: loc.owner_id,
    lat: loc.lat,
    lng: loc.lng,
    profile: profiles?.find((p) => p.id === loc.owner_id) ?? { name: 'Unknown', photo_url: null },
    dogs: dogs?.filter((d) => d.owner_id === loc.owner_id) ?? [],
  }));
}
