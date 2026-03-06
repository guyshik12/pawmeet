import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Image, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { useAuthStore } from '../../store/authStore';
import { createDog, updateDog } from '../../services/dogService';
import { pickAndUploadImage } from '../../utils/imageUpload';
import { Dog } from '../../types/database.types';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

const SLOT_GAP = 8;

// Defined outside to avoid hook-in-loop
type SlotProps = {
  idx: number;
  url: string | null;
  isMain: boolean;
  uploading: boolean;
  gesture: ReturnType<typeof Gesture.Race>;
  dragFromIdx: Animated.SharedValue<number>;
  dragX: Animated.SharedValue<number>;
};
function PhotoSlotItem({ idx, url, isMain, uploading, gesture, dragFromIdx, dragX }: SlotProps) {
  const animStyle = useAnimatedStyle(() => {
    if (dragFromIdx.value !== idx) return {};
    return {
      transform: [{ translateX: dragX.value }, { scale: withSpring(1.07) }],
      zIndex: 99,
      opacity: 0.85,
    };
  });
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[photoSlotStyles.slot, animStyle]}>
        {url ? (
          <Image source={{ uri: url }} style={photoSlotStyles.img} />
        ) : (
          <View style={photoSlotStyles.empty}>
            <Text style={photoSlotStyles.plus}>{isMain ? '🐶' : '+'}</Text>
          </View>
        )}
        {uploading && (
          <View style={photoSlotStyles.overlay}>
            <ActivityIndicator color="#fff" />
          </View>
        )}
        {isMain && (
          <View style={photoSlotStyles.badge}>
            <Text style={photoSlotStyles.badgeText}>Main</Text>
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}
const photoSlotStyles = StyleSheet.create({
  slot: {
    flex: 1, aspectRatio: 1, borderRadius: borderRadius.md, overflow: 'hidden',
    position: 'relative', backgroundColor: colors.border,
  },
  img: { width: '100%', height: '100%' },
  empty: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed',
    borderRadius: borderRadius.md,
  },
  plus: { fontSize: 28 },
  overlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  badge: {
    position: 'absolute', bottom: 4, left: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});

type EnergyLevel = 'Puppy' | 'High Energy' | 'Medium Energy' | 'Low Energy' | 'Senior';
type Size = 'Toy' | 'Small' | 'Medium' | 'Large' | 'Giant';
type TrainingLevel = 'Untrained' | 'Basic' | 'Well-trained' | 'Professional';
type YesNoDepends = 'Yes' | 'No' | 'Depends';
type Gender = 'Male' | 'Female';

type Prompt = { question: string; answer: string };

const PROMPT_QUESTIONS = [
  "The fastest way to my heart is…",
  "My most embarrassing habit is…",
  "If I could talk, my first word would be…",
  "My favorite local spot to explore is…",
  "My special talent is…",
  "I get zoomies when…",
  "My arch nemesis is…",
  "The thing I love most about my human is…",
];

const ENERGY_LEVELS: EnergyLevel[] = ['Puppy', 'High Energy', 'Medium Energy', 'Low Energy', 'Senior'];
const SIZES: Size[] = ['Toy', 'Small', 'Medium', 'Large', 'Giant'];
const TRAINING_LEVELS: TrainingLevel[] = ['Untrained', 'Basic', 'Well-trained', 'Professional'];
const TEMPERAMENT_OPTIONS = ['Playful', 'Calm', 'Energetic', 'Gentle', 'Independent', 'Loyal', 'Curious', 'Protective'];
const ACTIVITY_OPTIONS = ['Fetch', 'Swimming', 'Hiking', 'Running', 'Tug of War', 'Agility', 'Frisbee', 'Socializing'];
const YES_NO_DEPENDS: YesNoDepends[] = ['Yes', 'No', 'Depends'];
const YES_NO = ['Yes', 'No'];
const GENDERS: Gender[] = ['Male', 'Female'];

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
  const [gender, setGender] = useState<Gender | null>(null);
  // All 3 photos in one array: [main, extra1, extra2]
  const [allPhotos, setAllPhotos] = useState<(string | null)[]>([null, null, null]);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);

  // Drag-and-drop shared values
  const dragFromIdx = useSharedValue(-1);
  const dragX = useSharedValue(0);
  const slotWidth = useSharedValue(0);
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [trainingLevel, setTrainingLevel] = useState<TrainingLevel | null>(null);
  const [temperament, setTemperament] = useState<string[]>([]);
  const [activities, setActivities] = useState<string[]>([]);
  const [goodWithDogs, setGoodWithDogs] = useState<YesNoDepends | null>(null);
  const [goodWithKids, setGoodWithKids] = useState<YesNoDepends | null>(null);
  const [vaccinated, setVaccinated] = useState<boolean | null>(null);
  const [neutered, setNeutered] = useState<boolean | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (dog) {
      setName(dog.name);
      setBreed(dog.breed ?? '');
      setAge(dog.age_years?.toString() ?? '');
      setBio(dog.bio ?? '');
      setGender((dog.gender as Gender) ?? null);
      const extras = dog.photos ?? [];
      setAllPhotos([dog.photo_url ?? null, extras[0] ?? null, extras[1] ?? null]);
      setEnergyLevel((dog.energy_level as EnergyLevel) ?? null);
      setSize((dog.size as Size) ?? null);
      setTrainingLevel((dog.training_level as TrainingLevel) ?? null);
      setTemperament(dog.temperament ?? []);
      setActivities(dog.activities ?? []);
      setGoodWithDogs((dog.good_with_dogs as YesNoDepends) ?? null);
      setGoodWithKids((dog.good_with_kids as YesNoDepends) ?? null);
      setVaccinated(dog.vaccinated ?? null);
      setNeutered(dog.neutered ?? null);
      setPrompts((dog.prompts as Prompt[]) ?? []);
    } else {
      setName(''); setBreed(''); setAge(''); setBio('');
      setGender(null); setAllPhotos([null, null, null]);
      setEnergyLevel(null); setSize(null); setTrainingLevel(null);
      setTemperament([]); setActivities([]);
      setGoodWithDogs(null); setGoodWithKids(null);
      setVaccinated(null); setNeutered(null);
      setPrompts([]);
    }
  }, [dog, visible]);

  const toggleMulti = (arr: string[], setArr: (v: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const handlePickPhoto = useCallback(async (slot: number) => {
    if (!user) return;
    setUploadingSlot(slot);
    try {
      const baseId = dog ? dog.id : `new-${user.id}`;
      // Include timestamp in path to bust the CDN/image cache on updates
      const path = `dog-${baseId}-slot${slot}-${Date.now()}`;
      const url = await pickAndUploadImage('dog-photos', path);
      if (url) {
        setAllPhotos((prev) => {
          const next = [...prev];
          next[slot] = url;
          return next;
        });
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setUploadingSlot(null);
    }
  }, [user, dog]);

  const reorderPhotos = useCallback((from: number, to: number) => {
    setAllPhotos((prev) => {
      const next = [...prev];
      const temp = next[from];
      next[from] = next[to];
      next[to] = temp;
      return next;
    });
  }, []);

  const makeGesture = useCallback((idx: number) => {
    const tap = Gesture.Tap()
      .maxDuration(400)
      .onEnd(() => runOnJS(handlePickPhoto)(idx));

    const drag = Gesture.Pan()
      .activateAfterLongPress(400)
      .onStart(() => {
        dragFromIdx.value = idx;
        dragX.value = 0;
      })
      .onChange((e) => {
        dragX.value = e.translationX;
      })
      .onEnd(() => {
        const sw = slotWidth.value;
        if (sw > 0) {
          const currentX = idx * (sw + SLOT_GAP) + dragX.value;
          const target = Math.max(0, Math.min(2, Math.round(currentX / (sw + SLOT_GAP))));
          if (target !== idx) runOnJS(reorderPhotos)(idx, target);
        }
        dragFromIdx.value = -1;
        dragX.value = 0;
      })
      .onFinalize(() => {
        dragFromIdx.value = -1;
        dragX.value = 0;
      });

    return Gesture.Race(drag, tap);
  }, [handlePickPhoto, reorderPhotos, dragFromIdx, dragX, slotWidth]);

  const gesture0 = useMemo(() => makeGesture(0), [makeGesture]);
  const gesture1 = useMemo(() => makeGesture(1), [makeGesture]);
  const gesture2 = useMemo(() => makeGesture(2), [makeGesture]);

  const handleSave = async () => {
    if (!user || !name.trim()) {
      Alert.alert('Error', 'Dog name is required');
      return;
    }
    setSaving(true);
    try {
      const [mainPhoto, ...extras] = allPhotos;
      const photos = extras.filter(Boolean) as string[];
      const payload = {
        name: name.trim(),
        breed: breed.trim() || null,
        age_years: age ? parseFloat(age) : null,
        bio: bio.trim() || null,
        photo_url: mainPhoto ?? null,
        gender,
        photos: photos.length ? photos : null,
        energy_level: energyLevel,
        size,
        training_level: trainingLevel,
        temperament: temperament.length ? temperament : null,
        activities: activities.length ? activities : null,
        good_with_dogs: goodWithDogs,
        good_with_kids: goodWithKids,
        vaccinated,
        neutered,
        prompts: prompts.filter((p) => p.question && p.answer.trim()).length > 0
          ? prompts.filter((p) => p.question && p.answer.trim())
          : null,
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

  const renderChip = (label: string, selected: boolean, onPress: () => void) => (
    <TouchableOpacity key={label} style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );

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
          {/* Photos row — 3 slots, drag-and-drop to reorder */}
          <Text style={styles.label}>Photos</Text>
          <Text style={[styles.label, { color: colors.textLight, fontWeight: '400', marginTop: -4 }]}>
            Hold and drag to reorder
          </Text>
          <View
            style={styles.photoRow}
            onLayout={(e) => {
              slotWidth.value = (e.nativeEvent.layout.width - 2 * SLOT_GAP) / 3;
            }}
          >
            <PhotoSlotItem
              idx={0} url={allPhotos[0]} isMain gesture={gesture0}
              uploading={uploadingSlot === 0} dragFromIdx={dragFromIdx} dragX={dragX}
            />
            <PhotoSlotItem
              idx={1} url={allPhotos[1]} isMain={false} gesture={gesture1}
              uploading={uploadingSlot === 1} dragFromIdx={dragFromIdx} dragX={dragX}
            />
            <PhotoSlotItem
              idx={2} url={allPhotos[2]} isMain={false} gesture={gesture2}
              uploading={uploadingSlot === 2} dragFromIdx={dragFromIdx} dragX={dragX}
            />
          </View>

          {/* Name */}
          <Text style={styles.label}>Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Dog's name" placeholderTextColor={colors.textLight} />

          {/* Gender */}
          <Text style={styles.label}>Gender</Text>
          <View style={styles.pillRow}>
            {GENDERS.map((g) => renderChip(g === 'Male' ? '♂ Male' : '♀ Female', gender === g, () => setGender(gender === g ? null : g)))}
          </View>

          {/* Breed */}
          <Text style={styles.label}>Breed</Text>
          <TextInput style={styles.input} value={breed} onChangeText={setBreed} placeholder="e.g. Golden Retriever" placeholderTextColor={colors.textLight} />

          {/* Age */}
          <Text style={styles.label}>Age (years)</Text>
          <TextInput style={styles.input} value={age} onChangeText={setAge} placeholder="e.g. 2.5" placeholderTextColor={colors.textLight} keyboardType="decimal-pad" />

          {/* Size */}
          <Text style={styles.label}>Size</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipScrollContent}>
            {SIZES.map((s) => renderChip(s, size === s, () => setSize(size === s ? null : s)))}
          </ScrollView>

          {/* Energy Level */}
          <Text style={styles.label}>Energy Level</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipScrollContent}>
            {ENERGY_LEVELS.map((level) => renderChip(level, energyLevel === level, () => setEnergyLevel(energyLevel === level ? null : level)))}
          </ScrollView>

          {/* Training Level */}
          <Text style={styles.label}>Training Level</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipScrollContent}>
            {TRAINING_LEVELS.map((t) => renderChip(t, trainingLevel === t, () => setTrainingLevel(trainingLevel === t ? null : t)))}
          </ScrollView>

          {/* Temperament */}
          <Text style={styles.label}>Temperament</Text>
          <View style={styles.chipWrap}>
            {TEMPERAMENT_OPTIONS.map((t) => renderChip(t, temperament.includes(t), () => toggleMulti(temperament, setTemperament, t)))}
          </View>

          {/* Activities */}
          <Text style={styles.label}>Favorite Activities</Text>
          <View style={styles.chipWrap}>
            {ACTIVITY_OPTIONS.map((a) => renderChip(a, activities.includes(a), () => toggleMulti(activities, setActivities, a)))}
          </View>

          {/* Good with other dogs */}
          <Text style={styles.label}>Good with other dogs</Text>
          <View style={styles.pillRow}>
            {YES_NO_DEPENDS.map((v) => renderChip(v, goodWithDogs === v, () => setGoodWithDogs(goodWithDogs === v ? null : v)))}
          </View>

          {/* Good with kids */}
          <Text style={styles.label}>Good with kids</Text>
          <View style={styles.pillRow}>
            {YES_NO_DEPENDS.map((v) => renderChip(v, goodWithKids === v, () => setGoodWithKids(goodWithKids === v ? null : v)))}
          </View>

          {/* Vaccinated */}
          <Text style={styles.label}>Vaccinated</Text>
          <View style={styles.pillRow}>
            {YES_NO.map((v) => {
              const boolVal = v === 'Yes';
              return renderChip(v, vaccinated === boolVal, () => setVaccinated(vaccinated === boolVal ? null : boolVal));
            })}
          </View>

          {/* Neutered */}
          <Text style={styles.label}>Neutered / Spayed</Text>
          <View style={styles.pillRow}>
            {YES_NO.map((v) => {
              const boolVal = v === 'Yes';
              return renderChip(v, neutered === boolVal, () => setNeutered(neutered === boolVal ? null : boolVal));
            })}
          </View>

          {/* Icebreakers */}
          <Text style={styles.label}>Doggy Icebreakers 🐾</Text>
          <Text style={styles.subLabel}>Pick up to 3 fun questions to show your dog's personality</Text>
          {prompts.map((p, i) => (
            <View key={i} style={styles.icebreakerCard}>
              <View style={styles.icebreakerHeader}>
                <Text style={styles.icebreakerNum}>Question {i + 1}</Text>
                <TouchableOpacity onPress={() => setPrompts(prompts.filter((_, j) => j !== i))}>
                  <Text style={styles.icebreakerRemove}>✕ Remove</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipScrollContent}>
                {PROMPT_QUESTIONS.map((q) => renderChip(q, p.question === q, () => {
                  const next = [...prompts];
                  next[i] = { ...next[i], question: q };
                  setPrompts(next);
                }))}
              </ScrollView>
              {p.question ? (
                <>
                  <Text style={styles.selectedQuestion}>"{p.question}"</Text>
                  <TextInput
                    style={[styles.input, { marginTop: spacing.xs }]}
                    value={p.answer}
                    onChangeText={(text) => {
                      const next = [...prompts];
                      next[i] = { ...next[i], answer: text };
                      setPrompts(next);
                    }}
                    placeholder="Your dog's answer…"
                    placeholderTextColor={colors.textLight}
                    multiline
                  />
                </>
              ) : null}
            </View>
          ))}
          {prompts.length < 3 && (
            <TouchableOpacity
              style={styles.addIcebreakerBtn}
              onPress={() => setPrompts([...prompts, { question: '', answer: '' }])}
            >
              <Text style={styles.addIcebreakerText}>+ Add Icebreaker</Text>
            </TouchableOpacity>
          )}

          {/* Bio */}
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

  photoRow: { flexDirection: 'row', gap: SLOT_GAP, marginBottom: spacing.md },

  label: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md,
    ...typography.body, color: colors.text,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  chipScroll: { marginBottom: spacing.md },
  chipScrollContent: { gap: spacing.xs, paddingBottom: 4 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  pillRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  chip: {
    paddingVertical: 8, paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: 'rgba(47,128,237,0.15)' },
  chipText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  chipTextSelected: { color: colors.primary, fontWeight: '700' },

  subLabel: { ...typography.caption, color: colors.textLight, marginBottom: spacing.sm },
  icebreakerCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    borderWidth: 1.5, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.md,
  },
  icebreakerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  icebreakerNum: { ...typography.bodySmall, color: colors.primary, fontWeight: '700' },
  icebreakerRemove: { ...typography.caption, color: colors.error },
  selectedQuestion: { ...typography.bodySmall, color: colors.textSecondary, fontStyle: 'italic', marginBottom: spacing.xs },
  addIcebreakerBtn: {
    borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed',
    borderRadius: borderRadius.md, padding: spacing.md,
    alignItems: 'center', marginBottom: spacing.md,
  },
  addIcebreakerText: { ...typography.body, color: colors.primary, fontWeight: '600' },
});
