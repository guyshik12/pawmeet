import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ScrollView, Image, ActivityIndicator, FlatList,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useDogStore } from '../../store/dogStore';
import { getDogs, deleteDog } from '../../services/dogService';
import { pickAndUploadImage } from '../../utils/imageUpload';
import { updateDog } from '../../services/dogService';
import { Dog } from '../../types/database.types';
import AddEditDogModal from '../dogs/AddEditDogModal';

export default function ProfileScreen() {
  const { user, profile } = useAuthStore();
  const queryClient = useQueryClient();
  const { dogs, currentDogId, setDogs, setCurrentDogId, currentDog } = useDogStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDog, setEditingDog] = useState<Dog | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ['dogs', user?.id],
    queryFn: async () => {
      const data = await getDogs(user!.id);
      setDogs(data);
      return data;
    },
    enabled: !!user,
  });

  const dog = currentDog();

  const handlePickDogPhoto = async () => {
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

  const handleDeleteDog = () => {
    if (!dog) return;
    Alert.alert('Remove Dog', `Remove ${dog.name} from your profile?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await deleteDog(dog.id);
          queryClient.invalidateQueries({ queryKey: ['dogs'] });
        },
      },
    ]);
  };

  const openEdit = () => { setEditingDog(dog); setModalVisible(true); };
  const openAdd = () => { setEditingDog(null); setModalVisible(true); };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Dog Switcher */}
      <View style={styles.switcherSection}>
        <FlatList
          data={[...dogs, null] as (Dog | null)[]}
          keyExtractor={(item) => item?.id ?? 'add'}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.switcherList}
          renderItem={({ item }) => {
            if (!item) {
              // "+ Add" button
              return (
                <TouchableOpacity style={styles.addDogChip} onPress={openAdd}>
                  <Text style={styles.addDogChipText}>+ Add</Text>
                </TouchableOpacity>
              );
            }
            const isActive = item.id === currentDogId;
            return (
              <TouchableOpacity
                style={[styles.dogChip, isActive && styles.dogChipActive]}
                onPress={() => setCurrentDogId(item.id)}
              >
                {item.photo_url ? (
                  <Image source={{ uri: item.photo_url }} style={styles.chipAvatar} />
                ) : (
                  <View style={styles.chipAvatarPlaceholder}>
                    <Text style={{ fontSize: 14 }}>🐶</Text>
                  </View>
                )}
                <Text style={[styles.chipName, isActive && styles.chipNameActive]} numberOfLines={1}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {dog ? (
        <>
          {/* Dog Identity Card */}
          <View style={styles.dogCard}>
            <TouchableOpacity onPress={handlePickDogPhoto} disabled={uploadingPhoto}>
              {dog.photo_url ? (
                <Image source={{ uri: dog.photo_url }} style={styles.dogPhoto} />
              ) : (
                <View style={styles.dogPhotoPlaceholder}>
                  <Text style={{ fontSize: 48 }}>🐶</Text>
                </View>
              )}
              {uploadingPhoto && (
                <View style={styles.photoOverlay}>
                  <ActivityIndicator color={colors.surface} />
                </View>
              )}
              <View style={styles.cameraHint}>
                <Text style={styles.cameraHintText}>📷</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.dogName}>{dog.name}</Text>
            {dog.breed ? <Text style={styles.dogBreed}>{dog.breed}</Text> : null}
            {dog.age_years ? <Text style={styles.dogAge}>{dog.age_years} years old</Text> : null}
            {dog.bio ? <Text style={styles.dogBio}>{dog.bio}</Text> : null}

            <View style={styles.dogActions}>
              <TouchableOpacity style={styles.editBtn} onPress={openEdit}>
                <Text style={styles.editBtnText}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteDog}>
                <Text style={styles.deleteBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.noDog}>
          <Text style={{ fontSize: 56, marginBottom: spacing.md }}>🦴</Text>
          <Text style={styles.noDogTitle}>No dogs yet</Text>
          <Text style={styles.noDogSubtitle}>Add your dog to get started!</Text>
          <TouchableOpacity style={styles.addFirstDogBtn} onPress={openAdd}>
            <Text style={styles.addFirstDogText}>+ Add My Dog</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Account Section */}
      <View style={styles.accountSection}>
        <Text style={styles.accountTitle}>Account</Text>
        <Text style={styles.accountName}>{profile?.name ?? 'Dog Owner'}</Text>
        <Text style={styles.accountEmail}>{user?.email}</Text>
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={() =>
            Alert.alert('Sign Out', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
            ])
          }
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <AddEditDogModal
        visible={modalVisible}
        dog={editingDog}
        onClose={() => setModalVisible(false)}
        onSaved={() => {
          setModalVisible(false);
          queryClient.invalidateQueries({ queryKey: ['dogs'] });
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Dog switcher
  switcherSection: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  switcherList: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  dogChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: borderRadius.full, borderWidth: 2, borderColor: colors.border,
    backgroundColor: colors.background,
  },
  dogChipActive: { borderColor: colors.primary, backgroundColor: '#FEF3EC' },
  chipAvatar: { width: 28, height: 28, borderRadius: 14 },
  chipAvatarPlaceholder: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center',
  },
  chipName: { ...typography.bodySmall, color: colors.textSecondary, maxWidth: 80 },
  chipNameActive: { color: colors.primary, fontWeight: '700' },
  addDogChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: borderRadius.full, borderWidth: 2, borderColor: colors.primary,
    borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center',
  },
  addDogChipText: { ...typography.bodySmall, color: colors.primary, fontWeight: '700' },

  // Dog card
  dogCard: { alignItems: 'center', padding: spacing.xl },
  dogPhoto: { width: 120, height: 120, borderRadius: 60 },
  dogPhotoPlaceholder: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center',
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 60, justifyContent: 'center', alignItems: 'center',
  },
  cameraHint: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: colors.surface, borderRadius: 12, padding: 4,
  },
  cameraHintText: { fontSize: 14 },
  dogName: { ...typography.h1, color: colors.text, marginTop: spacing.md },
  dogBreed: { ...typography.body, color: colors.primary, fontWeight: '600', marginTop: 2 },
  dogAge: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  dogBio: { ...typography.body, color: colors.text, textAlign: 'center', marginTop: spacing.md, paddingHorizontal: spacing.lg },
  dogActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  editBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
  },
  editBtnText: { ...typography.body, color: colors.surface, fontWeight: '700' },
  deleteBtn: {
    borderWidth: 1, borderColor: colors.error, borderRadius: borderRadius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
  },
  deleteBtnText: { ...typography.body, color: colors.error },

  // No dog state
  noDog: { alignItems: 'center', padding: spacing.xxl },
  noDogTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  noDogSubtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
  addFirstDogBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.xl,
  },
  addFirstDogText: { ...typography.body, color: colors.surface, fontWeight: '700' },

  // Account section
  accountSection: {
    margin: spacing.lg, padding: spacing.lg,
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  accountTitle: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '700', marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  accountName: { ...typography.body, color: colors.text, fontWeight: '600' },
  accountEmail: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.md },
  signOutButton: {
    borderWidth: 1, borderColor: colors.error, borderRadius: borderRadius.md,
    padding: spacing.sm, alignItems: 'center',
  },
  signOutText: { ...typography.body, color: colors.error, fontWeight: '600' },
});
