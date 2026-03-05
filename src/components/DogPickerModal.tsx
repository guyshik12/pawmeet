import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, FlatList,
  StyleSheet, Image, Alert,
} from 'react-native';
import { useDogStore } from '../store/dogStore';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { Dog } from '../types/database.types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onAddDog: () => void;
};

export default function DogPickerModal({ visible, onClose, onAddDog }: Props) {
  const { dogs, currentDogId, setCurrentDogId } = useDogStore();

  const handleSelect = (dog: Dog) => {
    setCurrentDogId(dog.id);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Switch Dog</Text>

          <FlatList
            data={dogs}
            keyExtractor={(d) => d.id}
            scrollEnabled={false}
            renderItem={({ item }) => {
              const isActive = item.id === currentDogId;
              return (
                <TouchableOpacity
                  style={[styles.row, isActive && styles.rowActive]}
                  onPress={() => handleSelect(item)}
                >
                  {item.photo_url ? (
                    <Image source={{ uri: item.photo_url }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={{ fontSize: 22 }}>🐶</Text>
                    </View>
                  )}
                  <View style={styles.rowInfo}>
                    <Text style={[styles.dogName, isActive && styles.dogNameActive]}>{item.name}</Text>
                    {item.breed ? <Text style={styles.dogBreed}>{item.breed}</Text> : null}
                  </View>
                  {isActive && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              );
            }}
          />

          <TouchableOpacity style={styles.addRow} onPress={() => { onClose(); onAddDog(); }}>
            <View style={styles.addIcon}>
              <Text style={{ fontSize: 22 }}>+</Text>
            </View>
            <Text style={styles.addText}>Add another dog</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: spacing.lg, paddingBottom: spacing.xl, paddingHorizontal: spacing.lg,
  },
  title: { ...typography.h3, color: colors.text, textAlign: 'center', marginBottom: spacing.lg },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md,
    borderRadius: borderRadius.md, paddingHorizontal: spacing.sm,
  },
  rowActive: { backgroundColor: colors.surfaceHigh },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: spacing.md },
  avatarPlaceholder: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.border,
    justifyContent: 'center', alignItems: 'center', marginRight: spacing.md,
  },
  rowInfo: { flex: 1 },
  dogName: { ...typography.body, color: colors.text, fontWeight: '600' },
  dogNameActive: { color: colors.primary },
  dogBreed: { ...typography.bodySmall, color: colors.textSecondary },
  checkmark: { fontSize: 18, color: colors.primary, fontWeight: '700' },
  addRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm, marginTop: spacing.xs,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  addIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.border,
    justifyContent: 'center', alignItems: 'center', marginRight: spacing.md,
  },
  addText: { ...typography.body, color: colors.primary, fontWeight: '600' },
  cancelBtn: {
    marginTop: spacing.md, padding: spacing.md,
    backgroundColor: colors.border, borderRadius: borderRadius.md, alignItems: 'center',
  },
  cancelText: { ...typography.body, color: colors.text, fontWeight: '600' },
});
