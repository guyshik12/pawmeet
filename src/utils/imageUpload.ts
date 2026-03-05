import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';

export async function pickAndUploadImage(
  bucket: 'avatars' | 'dog-photos',
  path: string
): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const filePath = `${path}.${ext}`;
  const contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;

  // Fetch the image as ArrayBuffer — works reliably in React Native
  const response = await fetch(asset.uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, arrayBuffer, { contentType, upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}
