import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Image, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { createDog, updateDog } from '../../services/dogService';
import { pickAndUploadImage } from '../../utils/imageUpload';
import { Dog } from '../../types/database.types';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

type Props = {
  visible: boolean;
  dog: Dog | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function AddEditDogModal({ visible, dog, onClose, onSaved }: Props) {
  const { user } = useAuthStore();
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (dog) {
      setName(dog.name);
      setBreed(dog.breed ?? '');
      setAge(dog.age_years?.toString() ?? '');
      setBio(dog.bio ?? '');
      setPhotoUrl(dog.photo_url ?? null);
    } else {
      setName(''); setBreed(''); setAge(''); setBio(''); setPhotoUrl(null);
    }
  }, [dog, visible]);

  const handlePickPhoto = async () => {
    if (!user) return;
    setUploadingPhoto(true);
    try {
      const path = dog ? `dog-${dog.id}` : `dog-new-${user.id}-${Date.now()}`;
      const url = await pickAndUploadImage('dog-photos', path);
      if (url) setPhotoUrl(url);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!user || !name.trim()) {
      Alert.alert('Error', 'Dog name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        breed: breed.trim() || undefined,
        age_years: age ? parseFloat(age) : undefined,
        bio: bio.trim() || undefined,
        photo_url: photoUrl ?? undefined,
      };
      if (dog) {
        await updateDog(dog.id, payload);
      } else {
        await createDog({ owner_id: user.id, ...payload });
      }
      onSaved();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{dog ? 'Edit Dog' : 'Add Dog'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[styles.save, saving && { opacity: 0.5 }]}>{saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Photo */}
          <TouchableOpacity style={styles.photoContainer} onPress={handlePickPhoto} disabled={uploadingPhoto}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={{ fontSize: 40 }}>🐶</Text>
              </View>
            )}
            {uploadingPhoto && (
              <View style={styles.photoOverlay}>
                <ActivityIndicator color={colors.surface} />
              </View>
            )}
            <Text style={styles.changePhoto}>Tap to add photo</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Dog's name" placeholderTextColor={colors.textLight} />

          <Text style={styles.label}>Breed</Text>
          <TextInput style={styles.input} value={breed} onChangeText={setBreed} placeholder="e.g. Golden Retriever" placeholderTextColor={colors.textLight} />

          <Text style={styles.label}>Age (years)</Text>
          <TextInput style={styles.input} value={age} onChangeText={setAge} placeholder="e.g. 2.5" placeholderTextColor={colors.textLight} keyboardType="decimal-pad" />

          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textArea]} value={bio} onChangeText={setBio}
            placeholder="Tell us about your dog…" placeholderTextColor={colors.textLight}
            multiline numberOfLines={3}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: { ...typography.h3, color: colors.text },
  cancel: { ...typography.body, color: colors.textSecondary },
  save: { ...typography.body, color: colors.primary, fontWeight: '700' },
  content: { padding: spacing.lg },
  photoContainer: { alignItems: 'center', marginBottom: spacing.lg },
  photo: { width: 100, height: 100, borderRadius: 50 },
  photoPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center',
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 50, justifyContent: 'center', alignItems: 'center',
  },
  changePhoto: { ...typography.bodySmall, color: colors.primary, marginTop: spacing.xs },
  label: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md,
    ...typography.body, color: colors.text,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
});
