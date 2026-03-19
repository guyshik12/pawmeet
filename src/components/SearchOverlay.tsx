import React, { useState, useRef, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Animated, Image, ActivityIndicator, TouchableWithoutFeedback,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { searchAll, SearchResults, SearchDogResult, SearchOwnerResult, SearchBreedResult } from '../services/searchService';
import { colors, spacing, typography, borderRadius } from '../constants/theme';

type PreviewData =
  | { kind: 'dog'; item: SearchDogResult }
  | { kind: 'owner'; item: SearchOwnerResult }
  | { kind: 'breed'; item: SearchBreedResult };

type Props = {
  visible: boolean;
  onClose: () => void;
  currentUserId: string;
};

const SHEET_HEIGHT = 340;

export default function SearchOverlay({ visible, onClose, currentUserId }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ dogs: [], owners: [], breeds: [], packs: [] });
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults({ dogs: [], owners: [], breeds: [], packs: [] });
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await searchAll(query, currentUserId);
        setResults(r);
        setSearched(true);
      } catch (_) {
        setResults({ dogs: [], owners: [], breeds: [], packs: [] });
        setSearched(true);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, currentUserId]);

  // Animate preview sheet
  useEffect(() => {
    if (preview) {
      Animated.spring(sheetAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 160,
      }).start();
    } else {
      Animated.spring(sheetAnim, {
        toValue: SHEET_HEIGHT,
        useNativeDriver: true,
        damping: 18,
        stiffness: 160,
      }).start();
    }
  }, [preview]);

  // Reset state when overlay closes
  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults({ dogs: [], owners: [], breeds: [], packs: [] });
      setSearched(false);
      setLoading(false);
      setPreview(null);
      sheetAnim.setValue(SHEET_HEIGHT);
    }
  }, [visible]);

  const hasResults =
    results.dogs.length > 0 || results.owners.length > 0 || results.breeds.length > 0;

  function openPreview(data: PreviewData) {
    setPreview(data);
  }

  function closePreview() {
    setPreview(null);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {/* Dismiss on backdrop tap (when no preview open) */}
        {!preview && (
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
        )}

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Svg width={18} height={18} viewBox="0 0 24 24" style={styles.searchIcon}>
            <Circle cx="10" cy="10" r="7" stroke={colors.textSecondary} strokeWidth="2" fill="none" />
            <Path d="M15.5 15.5L21 21" stroke={colors.textSecondary} strokeWidth="2" strokeLinecap="round" />
          </Svg>
          <TextInput
            style={styles.input}
            placeholder="Search dogs, breeds, owners..."
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {loading && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: spacing.sm }} />}
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Results */}
        <ScrollView
          style={styles.results}
          contentContainerStyle={styles.resultsContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {searched && !hasResults && !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No results for "{query}"</Text>
            </View>
          ) : null}

          {results.dogs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Dogs</Text>
              {results.dogs.map((dog) => (
                <TouchableOpacity
                  key={dog.dogId}
                  style={styles.resultRow}
                  activeOpacity={0.7}
                  onPress={() => openPreview({ kind: 'dog', item: dog })}
                >
                  <View style={styles.avatarSmall}>
                    {dog.dogPhoto ? (
                      <Image source={{ uri: dog.dogPhoto }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarEmoji}>🐶</Text>
                    )}
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName}>{dog.dogName}</Text>
                    {dog.dogBreed ? (
                      <Text style={styles.resultMeta}>{dog.dogBreed}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.resultRight}>{dog.ownerName}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {results.owners.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Owners</Text>
              {results.owners.map((owner) => (
                <TouchableOpacity
                  key={owner.ownerId}
                  style={styles.resultRow}
                  activeOpacity={0.7}
                  onPress={() => openPreview({ kind: 'owner', item: owner })}
                >
                  <View style={styles.avatarSmall}>
                    {owner.ownerPhoto ? (
                      <Image source={{ uri: owner.ownerPhoto }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarEmoji}>👤</Text>
                    )}
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName}>{owner.ownerName}</Text>
                    {owner.dogs.length > 0 ? (
                      <Text style={styles.resultMeta}>
                        Owner of {owner.dogs.map((d) => d.name).join(', ')}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {results.breeds.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Breeds</Text>
              {results.breeds.map((breed) => (
                <TouchableOpacity
                  key={breed.breed}
                  style={styles.resultRow}
                  activeOpacity={0.7}
                  onPress={() => openPreview({ kind: 'breed', item: breed })}
                >
                  <View style={styles.avatarSmall}>
                    <Text style={styles.avatarEmoji}>🐕</Text>
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName}>{breed.breed}</Text>
                    <Text style={styles.resultMeta}>{breed.count} dogs</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Bottom sheet preview */}
        {preview && (
          <TouchableWithoutFeedback onPress={closePreview}>
            <View style={styles.sheetBackdrop} />
          </TouchableWithoutFeedback>
        )}
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: sheetAnim }] },
          ]}
          pointerEvents={preview ? 'auto' : 'none'}
        >
          {preview && <SheetContent preview={preview} onClose={closePreview} />}
        </Animated.View>
      </View>
    </Modal>
  );
}

function SheetContent({ preview, onClose }: { preview: PreviewData; onClose: () => void }) {
  if (preview.kind === 'dog') {
    const dog = preview.item;
    return (
      <View style={styles.sheetInner}>
        <TouchableOpacity style={styles.sheetCloseBtn} onPress={onClose}>
          <Text style={styles.sheetCloseText}>✕</Text>
        </TouchableOpacity>
        {dog.dogPhoto ? (
          <Image source={{ uri: dog.dogPhoto }} style={styles.sheetPhoto} resizeMode="cover" />
        ) : (
          <View style={styles.sheetPhotoPlaceholder}>
            <Text style={{ fontSize: 64 }}>🐶</Text>
          </View>
        )}
        <Text style={styles.sheetName}>{dog.dogName}</Text>
        {dog.dogBreed ? <Text style={styles.sheetMeta}>{dog.dogBreed}</Text> : null}
        <Text style={styles.sheetOwner}>Owner: {dog.ownerName}</Text>
      </View>
    );
  }

  if (preview.kind === 'owner') {
    const owner = preview.item;
    return (
      <View style={styles.sheetInner}>
        <TouchableOpacity style={styles.sheetCloseBtn} onPress={onClose}>
          <Text style={styles.sheetCloseText}>✕</Text>
        </TouchableOpacity>
        {owner.ownerPhoto ? (
          <Image source={{ uri: owner.ownerPhoto }} style={styles.sheetPhoto} resizeMode="cover" />
        ) : (
          <View style={styles.sheetPhotoPlaceholder}>
            <Text style={{ fontSize: 64 }}>👤</Text>
          </View>
        )}
        <Text style={styles.sheetName}>{owner.ownerName}</Text>
        {owner.dogs.length > 0 ? (
          <Text style={styles.sheetMeta}>
            Owner of {owner.dogs.map((d) => d.name).join(', ')}
          </Text>
        ) : null}
      </View>
    );
  }

  if (preview.kind === 'breed') {
    const breed = preview.item;
    return (
      <View style={styles.sheetInner}>
        <TouchableOpacity style={styles.sheetCloseBtn} onPress={onClose}>
          <Text style={styles.sheetCloseText}>✕</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 64, marginBottom: spacing.md }}>🐕</Text>
        <Text style={styles.sheetName}>{breed.breed}</Text>
        <Text style={styles.sheetMeta}>{breed.count} dogs found nearby</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xxl + spacing.md,
    marginHorizontal: spacing.md,
    backgroundColor: colors.surfaceHigh,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: 0,
  },
  cancelText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  results: {
    flex: 1,
    marginTop: spacing.sm,
  },
  resultsContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  avatarSmall: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
  },
  avatarEmoji: {
    fontSize: 24,
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  resultName: {
    ...typography.h3,
    color: colors.text,
  },
  resultMeta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  resultRight: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sheetInner: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  sheetCloseBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetCloseText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  sheetPhoto: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  sheetPhotoPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sheetName: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sheetMeta: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  sheetOwner: {
    ...typography.bodySmall,
    color: colors.textLight,
  },
});
