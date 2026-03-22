# Search Results Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make dog and owner search results interactive — tapping a dog opens a bottom sheet preview with connect/chat/profile actions, tapping an owner expands to show their tappable dogs.

**Architecture:** Extend the existing `SearchResultsList` component in `FriendsScreen.tsx` with a dog preview bottom sheet (same pattern as the existing pack preview sheet) and expandable owner rows. Add `getFriendshipByDogs` service function for friendship lookup. Extend `SearchOwnerResult` to include dog IDs and photos.

**Tech Stack:** React Native, Supabase, @tanstack/react-query, Animated (spring)

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Modify | `src/services/searchService.ts` | Extend `SearchOwnerResult.dogs` to include `id` and `photo` |
| Modify | `src/services/friendService.ts` | Add `getFriendshipByDogs` function |
| Modify | `src/screens/friends/FriendsScreen.tsx` | Dog preview sheet, expandable owners, connect action in `SearchResultsList` |

---

## Task 1: Extend SearchOwnerResult and searchAll

**Files:**
- Modify: `src/services/searchService.ts`

- [ ] **Step 1: Update `SearchOwnerResult` type**

Change the `dogs` field from:
```typescript
dogs: { name: string; breed: string | null }[];
```
to:
```typescript
dogs: { id: string; name: string; breed: string | null; photo: string | null }[];
```

- [ ] **Step 2: Update the owner dogs mapping in `searchAll`**

Find the owners mapping (around line 93-95):
```typescript
dogs: (dogsRaw ?? [])
  .filter((d: any) => d.owner?.id === p.id)
  .map((d: any) => ({ name: d.name, breed: d.breed ?? null })),
```

Change to:
```typescript
dogs: (dogsRaw ?? [])
  .filter((d: any) => d.owner?.id === p.id)
  .map((d: any) => ({ id: d.id, name: d.name, breed: d.breed ?? null, photo: d.photo_url ?? null })),
```

- [ ] **Step 3: Commit**

```bash
git add src/services/searchService.ts
git commit -m "feat: extend SearchOwnerResult dogs with id and photo"
```

---

## Task 2: Add getFriendshipByDogs

**Files:**
- Modify: `src/services/friendService.ts`

- [ ] **Step 1: Add the function**

Add at the end of `friendService.ts`:

```typescript
export async function getFriendshipByDogs(
  myDogId: string,
  theirDogId: string,
): Promise<{ friendshipId: string; isUserA: boolean } | null> {
  const { data, error } = await supabase
    .from('friendships')
    .select('id, dog_a, user_a')
    .or(`and(dog_a.eq.${myDogId},dog_b.eq.${theirDogId}),and(dog_a.eq.${theirDogId},dog_b.eq.${myDogId})`)
    .maybeSingle();
  if (error || !data) return null;
  return {
    friendshipId: data.id,
    isUserA: (data as any).dog_a === myDogId,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/friendService.ts
git commit -m "feat: add getFriendshipByDogs for search dog preview"
```

---

## Task 3: Dog Preview Bottom Sheet + Expandable Owners

**Files:**
- Modify: `src/screens/friends/FriendsScreen.tsx`

This is the main task. All changes are inside the `SearchResultsList` component (defined at the bottom of `FriendsScreen.tsx`, around line 599+).

- [ ] **Step 1: Add imports**

Add to the existing imports at the top of `FriendsScreen.tsx`:

```typescript
import { getFriendshipByDogs, handleDogLike } from '../../services/friendService';
```

Note: `handleDogLike` might already be indirectly available. Check — if not, import it directly.

Also make sure `SearchDogResult` is imported from searchService (it should already be, via `SearchResults`).

- [ ] **Step 2: Add dog preview state to SearchResultsList**

Inside the `SearchResultsList` component, after the existing pack preview state (around line 613), add:

```typescript
const [previewDog, setPreviewDog] = useState<SearchDogResult | null>(null);
const [dogFriendship, setDogFriendship] = useState<{ friendshipId: string; isUserA: boolean } | null>(null);
const [connectSent, setConnectSent] = useState<Set<string>>(new Set());
const [connecting, setConnecting] = useState(false);
const dogSheetAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
const [expandedOwners, setExpandedOwners] = useState<Set<string>>(new Set());
```

- [ ] **Step 3: Add dog preview open/close functions**

After the pack preview functions:

```typescript
async function openDogPreview(dog: SearchDogResult) {
  setPreviewDog(dog);
  setDogFriendship(null);
  Animated.spring(dogSheetAnim, {
    toValue: 0,
    useNativeDriver: true,
    damping: 18,
    stiffness: 160,
  }).start();
  // Fetch friendship if they're friends
  if (dog.isFriend && activeDog?.id) {
    const fs = await getFriendshipByDogs(activeDog.id, dog.dogId);
    setDogFriendship(fs);
  }
}

function closeDogPreview() {
  Animated.spring(dogSheetAnim, {
    toValue: SHEET_HEIGHT,
    useNativeDriver: true,
    damping: 18,
    stiffness: 160,
  }).start(() => {
    setPreviewDog(null);
    setDogFriendship(null);
  });
}

async function handleConnect(dog: SearchDogResult) {
  if (!activeDog || !userId) return;
  setConnecting(true);
  try {
    const result = await handleDogLike(activeDog.id, dog.dogId, userId, dog.ownerId);
    setConnectSent((prev) => new Set([...prev, dog.dogId]));
    closeDogPreview();
    // If matched, the AppTabs realtime handler will show the match popup
  } catch (e) {
    console.error('[SearchResultsList] connect error:', e);
  } finally {
    setConnecting(false);
  }
}

function toggleOwner(ownerId: string) {
  setExpandedOwners((prev) => {
    const next = new Set(prev);
    if (next.has(ownerId)) next.delete(ownerId);
    else next.add(ownerId);
    return next;
  });
}
```

- [ ] **Step 4: Make dog rows tappable**

Replace the dogs section JSX (around line 721-742). Change `<View key={dog.dogId} style={searchStyles.resultRow}>` to `<TouchableOpacity key={dog.dogId} style={searchStyles.resultRow} onPress={() => openDogPreview(dog)} activeOpacity={0.7}>` and close with `</TouchableOpacity>` instead of `</View>`.

- [ ] **Step 5: Make owner rows expandable**

Replace the owners section JSX (around line 745-766). Change the owner `<View>` to `<TouchableOpacity onPress={() => toggleOwner(owner.ownerId)}>` and add expanded dog rows after:

```tsx
{results.owners.map((owner) => (
  <View key={owner.ownerId}>
    <TouchableOpacity style={searchStyles.resultRow} onPress={() => toggleOwner(owner.ownerId)} activeOpacity={0.7}>
      <View style={searchStyles.avatarSmall}>
        {owner.ownerPhoto
          ? <Image source={{ uri: owner.ownerPhoto }} style={searchStyles.avatarImg} />
          : <Text style={{ fontSize: 20 }}>👤</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={searchStyles.resultName}>{owner.ownerName}</Text>
        {owner.dogs.length > 0 && (
          <Text style={searchStyles.resultMeta}>
            {owner.dogs.map((d) => d.name).join(', ')}
          </Text>
        )}
      </View>
      <Text style={{ color: colors.textSecondary, fontSize: 16 }}>
        {expandedOwners.has(owner.ownerId) ? '▾' : '▸'}
      </Text>
    </TouchableOpacity>
    {expandedOwners.has(owner.ownerId) && owner.dogs.map((d) => (
      <TouchableOpacity
        key={d.id}
        style={[searchStyles.resultRow, { paddingLeft: spacing.xl }]}
        onPress={() => openDogPreview({
          type: 'dog',
          dogId: d.id,
          dogName: d.name,
          dogBreed: d.breed,
          dogPhoto: d.photo,
          ownerId: owner.ownerId,
          ownerName: owner.ownerName,
          isFriend: friendDogIds.has(d.id),
        } as SearchDogResult)}
        activeOpacity={0.7}
      >
        <View style={searchStyles.avatarSmall}>
          {d.photo
            ? <Image source={{ uri: d.photo }} style={searchStyles.avatarImg} />
            : <Text style={{ fontSize: 20 }}>🐶</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={searchStyles.resultName}>{d.name}</Text>
          {d.breed ? <Text style={searchStyles.resultMeta}>{d.breed}</Text> : null}
        </View>
      </TouchableOpacity>
    ))}
  </View>
))}
```

Note: `friendDogIds` is not available in `SearchResultsList`. It's computed in `searchAll`. Since `SearchDogResult` already has `isFriend`, pass it through. For owner-expanded dogs, we need to check — the simplest approach: pass the `friendDogIds` set as a prop, OR just set `isFriend: false` for expanded dogs and let the preview sheet check.

Actually simpler: the `SearchDogResult` list already has `isFriend` for all dogs. Create a lookup set inside `SearchResultsList`:

```typescript
const friendDogIdSet = new Set(results.dogs.filter((d) => d.isFriend).map((d) => d.dogId));
```

Then use `isFriend: friendDogIdSet.has(d.id)` in the expanded owner dogs.

- [ ] **Step 6: Add dog preview bottom sheet JSX**

After the existing pack preview sheet (around line 830), add the dog preview sheet. Same pattern:

```tsx
{/* Dog preview bottom sheet */}
{previewDog && (
  <TouchableWithoutFeedback onPress={closeDogPreview}>
    <View style={StyleSheet.absoluteFill} />
  </TouchableWithoutFeedback>
)}
<Animated.View
  style={[searchStyles.sheet, { transform: [{ translateY: dogSheetAnim }] }]}
  pointerEvents={previewDog ? 'auto' : 'none'}
>
  {previewDog && (
    <View style={searchStyles.sheetInner}>
      <TouchableOpacity style={searchStyles.sheetClose} onPress={closeDogPreview}>
        <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>✕</Text>
      </TouchableOpacity>
      {previewDog.dogPhoto ? (
        <Image source={{ uri: previewDog.dogPhoto }} style={{ width: 80, height: 80, borderRadius: 24, marginBottom: spacing.sm }} />
      ) : (
        <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: colors.surfaceHigh, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm }}>
          <Text style={{ fontSize: 36 }}>🐶</Text>
        </View>
      )}
      <Text style={[searchStyles.resultName, { fontSize: 20, marginBottom: 2 }]}>
        {previewDog.dogName}
      </Text>
      {previewDog.dogBreed && (
        <Text style={[searchStyles.resultMeta, { marginBottom: 2 }]}>{previewDog.dogBreed}</Text>
      )}
      <Text style={[searchStyles.resultMeta, { marginBottom: spacing.md }]}>
        with {previewDog.ownerName}
      </Text>

      {previewDog.isFriend ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TouchableOpacity
            style={[searchStyles.actionBtn, { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }]}
            onPress={() => {
              closeDogPreview();
              if (dogFriendship) {
                navigation.navigate('Chat', {
                  friendshipId: dogFriendship.friendshipId,
                  friendName: previewDog.ownerName,
                  friendDogName: previewDog.dogName,
                  isUserA: dogFriendship.isUserA,
                });
              }
            }}
            disabled={!dogFriendship}
          >
            <Text style={searchStyles.actionBtnText}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[searchStyles.actionBtn, searchStyles.actionBtnOutline, { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }]}
            onPress={() => {
              closeDogPreview();
              if (dogFriendship) {
                navigation.navigate('FriendProfile', {
                  dog: { id: previewDog.dogId, name: previewDog.dogName, breed: previewDog.dogBreed, photo_url: previewDog.dogPhoto, owner_id: previewDog.ownerId },
                  ownerProfile: { name: previewDog.ownerName },
                  ownerId: previewDog.ownerId,
                  friendshipId: dogFriendship.friendshipId,
                  isUserA: dogFriendship.isUserA,
                  friendName: previewDog.ownerName,
                });
              }
            }}
            disabled={!dogFriendship}
          >
            <Text style={[searchStyles.actionBtnText, searchStyles.actionBtnOutlineText]}>Profile</Text>
          </TouchableOpacity>
        </View>
      ) : connectSent.has(previewDog.dogId) ? (
        <Text style={searchStyles.statusLabel}>Request Sent ✓</Text>
      ) : (
        <TouchableOpacity
          style={[searchStyles.actionBtn, { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }]}
          onPress={() => handleConnect(previewDog)}
          disabled={connecting}
        >
          <Text style={searchStyles.actionBtnText}>
            {connecting ? 'Connecting...' : 'Connect 🐾'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )}
</Animated.View>
```

- [ ] **Step 7: TypeScript check**

```bash
cd /Users/guyshik/DogPark && npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: no new errors beyond pre-existing ones.

- [ ] **Step 8: Commit**

```bash
git add src/screens/friends/FriendsScreen.tsx
git commit -m "feat: dog preview sheet + expandable owners in search results"
```

---

## Done ✓

All features shipped:
- ✅ Dog search results are tappable → bottom sheet preview
- ✅ Friends see Chat + Profile buttons
- ✅ Non-friends see Connect 🐾 button (mutual match triggers popup)
- ✅ Owner search results expand to show tappable dogs
- ✅ Extended SearchOwnerResult with dog IDs and photos
