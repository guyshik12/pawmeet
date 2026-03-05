import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, Image, ActivityIndicator, FlatList,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { getProfile, updateProfile } from '../../services/profileService';
import { getDogs, deleteDog } from '../../services/dogService';
import { pickAndUploadImage } from '../../utils/imageUpload';
import { Dog } from '../../types/database.types';
import AddEditDogModal from '../dogs/AddEditDogModal';

type Tab = 'profile' | 'dogs';

export default function ProfileScreen() {
  const { user, profile, setProfile } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [name, setName] = useState(profile?.name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDog, setEditingDog] = useState<Dog | null>(null);

  useEffect(() => {
    if (!profile && user) {
      getProfile(user.id).then((p) => { if (p) setProfile(p); });
    }
  }, [user]);

  useEffect(() => {
    setName(profile?.name ?? '');
    setBio(profile?.bio ?? '');
  }, [profile]);

  const { data: dogs = [], isLoading: dogsLoading } = useQuery({
    queryKey: ['dogs', user?.id],
    queryFn: () => getDogs(user!.id),
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDog,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dogs'] }),
  });

  const handleSave = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    try {
      const updated = await updateProfile(user.id, { name: name.trim(), bio: bio.trim() });
      setProfile(updated);
      Alert.alert('Saved', 'Profile updated!');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePickPhoto = async () => {
    if (!user) return;
    setUploadingPhoto(true);
    try {
      const url = await pickAndUploadImage('avatars', user.id);
      if (url) {
        const updated = await updateProfile(user.id, { photo_url: url });
        setProfile(updated);
      }
    } catch (e: any) {
      Alert.alert('Upload Error', e.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeleteDog = (dog: Dog) => {
    Alert.alert('Delete Dog', `Remove ${dog.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(dog.id) },
    ]);
  };

  const openAddDog = () => { setEditingDog(null); setModalVisible(true); };
  const openEditDog = (dog: Dog) => { setEditingDog(dog); setModalVisible(true); };

  return (
    <View style={styles.container}>
      {/* Segment Control */}
      <View style={styles.segmentRow}>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'profile' && styles.segmentActive]}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={[styles.segmentText, activeTab === 'profile' && styles.segmentTextActive]}>Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'dogs' && styles.segmentActive]}
          onPress={() => setActiveTab('dogs')}
        >
          <Text style={[styles.segmentText, activeTab === 'dogs' && styles.segmentTextActive]}>
            My Dogs {dogs.length > 0 ? `(${dogs.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'profile' ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Avatar */}
          <TouchableOpacity style={styles.avatarContainer} onPress={handlePickPhoto} disabled={uploadingPhoto}>
            {profile?.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarEmoji}>👤</Text>
              </View>
            )}
            {uploadingPhoto && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color={colors.surface} />
              </View>
            )}
            <Text style={styles.changePhoto}>Change Photo</Text>
          </TouchableOpacity>

          <Text style={styles.email}>{user?.email}</Text>

          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={styles.input} value={name} onChangeText={setName}
            placeholder="Your name" placeholderTextColor={colors.textLight} autoCapitalize="words"
          />

          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textArea]} value={bio} onChangeText={setBio}
            placeholder="Tell other dog owners about yourself…" placeholderTextColor={colors.textLight}
            multiline numberOfLines={3}
          />

          <TouchableOpacity style={[styles.button, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
            <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save Profile'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signOutButton} onPress={() =>
            Alert.alert('Sign Out', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
            ])
          }>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {dogsLoading ? (
            <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
          ) : (
            <FlatList
              data={dogs}
              keyExtractor={(d) => d.id}
              contentContainerStyle={dogs.length === 0 ? styles.emptyContainer : styles.list}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={{ fontSize: 56, marginBottom: spacing.md }}>🦴</Text>
                  <Text style={styles.emptyTitle}>No dogs yet</Text>
                  <Text style={styles.emptySubtitle}>Tap below to add your first dog!</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.card}>
                  {item.photo_url ? (
                    <Image source={{ uri: item.photo_url }} style={styles.dogPhoto} />
                  ) : (
                    <View style={styles.dogPhotoPlaceholder}>
                      <Text style={{ fontSize: 28 }}>🐶</Text>
                    </View>
                  )}
                  <View style={styles.dogInfo}>
                    <Text style={styles.dogName}>{item.name}</Text>
                    {item.breed ? <Text style={styles.dogMeta}>{item.breed}</Text> : null}
                    {item.age_years ? <Text style={styles.dogMeta}>{item.age_years} yrs</Text> : null}
                    {item.bio ? <Text style={styles.dogBio} numberOfLines={2}>{item.bio}</Text> : null}
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => openEditDog(item)} style={styles.editBtn}>
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteDog(item)} style={styles.deleteBtn}>
                      <Text style={styles.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
          <TouchableOpacity style={styles.fab} onPress={openAddDog}>
            <Text style={styles.fabText}>+ Add Dog</Text>
          </TouchableOpacity>
        </View>
      )}

      <AddEditDogModal
        visible={modalVisible}
        dog={editingDog}
        onClose={() => setModalVisible(false)}
        onSaved={() => {
          setModalVisible(false);
          queryClient.invalidateQueries({ queryKey: ['dogs'] });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  segmentRow: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  segment: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  segmentActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  segmentText: { ...typography.body, color: colors.textSecondary },
  segmentTextActive: { color: colors.primary, fontWeight: '700' },
  content: { padding: spacing.lg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  avatarContainer: { alignItems: 'center', marginBottom: spacing.md },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center',
  },
  avatarEmoji: { fontSize: 40 },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 48, justifyContent: 'center', alignItems: 'center',
  },
  changePhoto: { ...typography.bodySmall, color: colors.primary, marginTop: spacing.xs },
  email: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  label: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md,
    ...typography.body, color: colors.text,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  button: {
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center', marginBottom: spacing.md,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { ...typography.body, color: colors.surface, fontWeight: '700' },
  signOutButton: {
    borderWidth: 1, borderColor: colors.error, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center',
  },
  signOutText: { ...typography.body, color: colors.error, fontWeight: '600' },
  list: { padding: spacing.md, paddingBottom: 100 },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  emptySubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    padding: spacing.md, marginBottom: spacing.md,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  dogPhoto: { width: 56, height: 56, borderRadius: 28, marginRight: spacing.md },
  dogPhotoPlaceholder: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.border,
    justifyContent: 'center', alignItems: 'center', marginRight: spacing.md,
  },
  dogInfo: { flex: 1 },
  dogName: { ...typography.h3, color: colors.text },
  dogMeta: { ...typography.bodySmall, color: colors.textSecondary },
  dogBio: { ...typography.bodySmall, color: colors.textLight, marginTop: 2 },
  cardActions: { flexDirection: 'column', alignItems: 'center', gap: spacing.xs },
  editBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  editBtnText: { ...typography.caption, color: colors.surface, fontWeight: '700' },
  deleteBtn: {
    backgroundColor: colors.border, borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  deleteBtnText: { ...typography.caption, color: colors.error, fontWeight: '700' },
  fab: {
    position: 'absolute', bottom: spacing.xl, right: spacing.lg,
    backgroundColor: colors.primary, borderRadius: borderRadius.full,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  fabText: { ...typography.body, color: colors.surface, fontWeight: '700' },
});
