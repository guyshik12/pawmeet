import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, Image, ActivityIndicator,
} from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { getProfile, updateProfile } from '../../services/profileService';
import { pickAndUploadImage } from '../../utils/imageUpload';

export default function ProfileScreen() {
  const { user, profile, setProfile } = useAuthStore();
  const [name, setName] = useState(profile?.name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (!profile && user) {
      getProfile(user.id).then((p) => { if (p) setProfile(p); });
    }
  }, [user]);

  useEffect(() => {
    setName(profile?.name ?? '');
    setBio(profile?.bio ?? '');
  }, [profile]);

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
      Alert.alert('Error', e.message);
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        placeholderTextColor={colors.textLight}
        autoCapitalize="words"
      />

      <Text style={styles.label}>Bio</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={bio}
        onChangeText={setBio}
        placeholder="Tell other dog owners about yourself…"
        placeholderTextColor={colors.textLight}
        multiline
        numberOfLines={3}
      />

      <TouchableOpacity style={[styles.button, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save Profile'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  avatarContainer: { alignItems: 'center', marginBottom: spacing.md },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center',
  },
  avatarEmoji: { fontSize: 40 },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 48,
    justifyContent: 'center', alignItems: 'center',
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
});
