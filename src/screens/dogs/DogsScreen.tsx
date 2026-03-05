import React, { useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, Image, ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { getDogs, deleteDog } from '../../services/dogService';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { Dog } from '../../types/database.types';
import AddEditDogModal from './AddEditDogModal';

export default function DogsScreen() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = React.useState(false);
  const [editingDog, setEditingDog] = React.useState<Dog | null>(null);

  const { data: dogs = [], isLoading } = useQuery({
    queryKey: ['dogs', user?.id],
    queryFn: () => getDogs(user!.id),
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDog,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dogs'] }),
  });

  const handleDelete = (dog: Dog) => {
    Alert.alert('Delete Dog', `Remove ${dog.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(dog.id) },
    ]);
  };

  const openAdd = () => { setEditingDog(null); setModalVisible(true); };
  const openEdit = (dog: Dog) => { setEditingDog(dog); setModalVisible(true); };

  const renderDog = ({ item }: { item: Dog }) => (
    <View style={styles.card}>
      {item.photo_url ? (
        <Image source={{ uri: item.photo_url }} style={styles.dogPhoto} />
      ) : (
        <View style={styles.dogPhotoPlaceholder}>
          <Text style={{ fontSize: 32 }}>🐶</Text>
        </View>
      )}
      <View style={styles.dogInfo}>
        <Text style={styles.dogName}>{item.name}</Text>
        {item.breed ? <Text style={styles.dogMeta}>{item.breed}</Text> : null}
        {item.age_years ? <Text style={styles.dogMeta}>{item.age_years} yrs</Text> : null}
        {item.bio ? <Text style={styles.dogBio} numberOfLines={2}>{item.bio}</Text> : null}
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity onPress={() => openEdit(item)} style={styles.editBtn}>
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={dogs}
        keyExtractor={(d) => d.id}
        renderItem={renderDog}
        contentContainerStyle={dogs.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🦴</Text>
            <Text style={styles.emptyTitle}>No dogs yet</Text>
            <Text style={styles.emptySubtitle}>Add your first dog to get started!</Text>
          </View>
        }
      />
      <TouchableOpacity style={styles.fab} onPress={openAdd}>
        <Text style={styles.fabText}>+ Add Dog</Text>
      </TouchableOpacity>

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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: spacing.md },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyEmoji: { fontSize: 56, marginBottom: spacing.md },
  emptyTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  emptySubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    padding: spacing.md, marginBottom: spacing.md,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  dogPhoto: { width: 60, height: 60, borderRadius: 30, marginRight: spacing.md },
  dogPhotoPlaceholder: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: colors.border,
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
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  fabText: { ...typography.body, color: colors.surface, fontWeight: '700' },
});
