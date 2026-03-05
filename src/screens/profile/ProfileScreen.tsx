import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ScrollView, Image, ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useDogStore } from '../../store/dogStore';
import { getDogs, updateDog } from '../../services/dogService';
import { pickAndUploadImage } from '../../utils/imageUpload';
import { Dog } from '../../types/database.types';
import AddEditDogModal from '../dogs/AddEditDogModal';

type Props = {
  navigation: any;
};

export default function ProfileScreen({ navigation }: Props) {
  const { user, profile } = useAuthStore();
  const queryClient = useQueryClient();
  const { setDogs, currentDog } = useDogStore();
  const [editingDog, setEditingDog] = useState<Dog | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useQuery({
    queryKey: ['dogs', user?.id],
    queryFn: async () => {
      const data = await getDogs(user!.id);
      setDogs(data);
      return data;
    },
    enabled: !!user,
  });

  const dog = currentDog();

  const handlePickPhoto = async () => {
    if (!dog) return;
    setUploadingPhoto(true);
    try {
      const url = await pickAndUploadImage('dog-photos', `dog-${dog.id}`);
      if (url) {
        await updateDog(dog.id, { photo_url: url });
        queryClient.invalidateQueries({ queryKey: ['dogs'] });
      }
    } catch (e: any) {
      Alert.alert('Upload Error', e.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  if (!dog) {
    return (
      <View style={styles.noDog}>
        <Text style={styles.noDogEmoji}>🦴</Text>
        <Text style={styles.noDogTitle}>No dog yet</Text>
        <Text style={styles.noDogSubtitle}>Add your dog to get started!</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setEditingDog(null); setModalVisible(true); }}>
          <Text style={styles.addBtnText}>+ Add My Dog</Text>
        </TouchableOpacity>
        <AddEditDogModal
          visible={modalVisible}
          dog={null}
          onClose={() => setModalVisible(false)}
          onSaved={() => { setModalVisible(false); queryClient.invalidateQueries({ queryKey: ['dogs'] }); }}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Dog Photo */}
      <TouchableOpacity style={styles.photoContainer} onPress={handlePickPhoto} disabled={uploadingPhoto}>
        {dog.photo_url ? (
          <Image source={{ uri: dog.photo_url }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={{ fontSize: 64 }}>🐶</Text>
          </View>
        )}
        {uploadingPhoto ? (
          <View style={styles.photoOverlay}>
            <ActivityIndicator color={colors.surface} size="large" />
          </View>
        ) : (
          <View style={styles.cameraHint}>
            <Text style={styles.cameraHintText}>📷</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Dog Info */}
      <Text style={styles.dogName}>{dog.name}</Text>
      {dog.breed ? <Text style={styles.dogBreed}>{dog.breed}</Text> : null}
      {dog.age_years ? <Text style={styles.dogAge}>{dog.age_years} years old</Text> : null}
      {dog.bio ? <Text style={styles.dogBio}>{dog.bio}</Text> : null}

      {/* Edit Button */}
      <TouchableOpacity style={styles.editBtn} onPress={() => { setEditingDog(dog); setModalVisible(true); }}>
        <Text style={styles.editBtnText}>Edit Profile</Text>
      </TouchableOpacity>

      {/* Account section */}
      <View style={styles.accountSection}>
        <Text style={styles.accountLabel}>ACCOUNT</Text>
        <Text style={styles.accountName}>{profile?.name ?? 'Dog Owner'}</Text>
        <Text style={styles.accountEmail}>{user?.email}</Text>
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <AddEditDogModal
        visible={modalVisible}
        dog={editingDog}
        onClose={() => setModalVisible(false)}
        onSaved={() => { setModalVisible(false); queryClient.invalidateQueries({ queryKey: ['dogs'] }); }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { alignItems: 'center', paddingBottom: spacing.xxl },
  photoContainer: { marginTop: spacing.xl, marginBottom: spacing.lg },
  photo: { width: 140, height: 140, borderRadius: 70 },
  photoPlaceholder: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center',
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 70, justifyContent: 'center', alignItems: 'center',
  },
  cameraHint: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: colors.surface, borderRadius: 14, width: 28, height: 28,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  cameraHintText: { fontSize: 14 },
  dogName: { ...typography.h1, color: colors.text },
  dogBreed: { ...typography.body, color: colors.primary, fontWeight: '600', marginTop: 2 },
  dogAge: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  dogBio: {
    ...typography.body, color: colors.text, textAlign: 'center',
    marginTop: spacing.md, paddingHorizontal: spacing.xl,
  },
  editBtn: {
    marginTop: spacing.lg, backgroundColor: colors.primary,
    borderRadius: borderRadius.full, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl,
  },
  editBtnText: { ...typography.body, color: colors.surface, fontWeight: '700' },
  accountSection: {
    width: '90%', marginTop: spacing.xl, padding: spacing.lg,
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  accountLabel: {
    ...typography.caption, color: colors.textSecondary, fontWeight: '700',
    letterSpacing: 1, marginBottom: spacing.sm,
  },
  accountName: { ...typography.body, color: colors.text, fontWeight: '600' },
  accountEmail: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.md },
  signOutBtn: {
    borderWidth: 1, borderColor: colors.error,
    borderRadius: borderRadius.md, padding: spacing.sm, alignItems: 'center',
  },
  signOutText: { ...typography.body, color: colors.error, fontWeight: '600' },
  noDog: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, backgroundColor: colors.background },
  noDogEmoji: { fontSize: 64, marginBottom: spacing.md },
  noDogTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  noDogSubtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
  addBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
  addBtnText: { ...typography.body, color: colors.surface, fontWeight: '700' },
});
