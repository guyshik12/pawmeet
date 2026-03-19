# Groups & Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement fully functional Packs (group chat with public/semi-public/private types) and inline search in the Friends tab, replacing all placeholders.

**Architecture:** Service layer first (types → service functions → navigation types), then screens (CreatePack → PackChatScreen → inline search in FriendsScreen), finishing with cleanup (remove SearchOverlay from DiscoverScreen). Each task builds on the previous and can be verified independently with a TypeScript build check.

**Tech Stack:** React Native (Expo), Supabase (postgres + realtime), React Navigation (native stack), @tanstack/react-query, TypeScript

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Modify | `src/services/packService.ts` | Add `type` to `Pack`, update `createPack`/`sendPackMessage`, add `joinPack`/`createJoinRequest`/`getPackMembers` |
| Modify | `src/services/searchService.ts` | Add `SearchPackResult`, extend `searchAll` to return packs |
| Modify | `src/components/PackCard.tsx` | Add `type` prop and badge rendering |
| Modify | `src/navigation/AppTabs.tsx` | Update `FriendsStackParamList` to include `memberCount` in PackChat params |
| Modify | `src/screens/friends/FriendsScreen.tsx` | Add "+" header button, update PackCard nav call, add inline search |
| Create | `src/screens/friends/CreatePackScreen.tsx` | New screen: pack name + type picker + friend-picker |
| Create | `src/screens/chat/PackChatScreen.tsx` | New screen: group chat with grouped-sender message rendering |
| Modify | `src/screens/discover/DiscoverScreen.tsx` | Remove SearchOverlay |

---

## Task 1: Supabase Schema Migrations

Run these in the Supabase SQL editor (Dashboard → SQL Editor).

**Files:** Supabase dashboard only — no code changes in this task.

- [ ] **Step 1: Add `type` column to `packs` table**

```sql
ALTER TABLE packs
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'public'
  CHECK (type IN ('public', 'semi_public', 'private'));
```

- [ ] **Step 2: Add `sender_dog_id` to `messages` table**

```sql
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS sender_dog_id uuid REFERENCES dogs(id) ON DELETE SET NULL;
```

- [ ] **Step 3: Create `pack_join_requests` table**

```sql
CREATE TABLE IF NOT EXISTS pack_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dog_id uuid REFERENCES dogs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pack_id, user_id)
);

ALTER TABLE pack_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own requests"
  ON pack_join_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view requests for their packs or their own"
  ON pack_join_requests FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT created_by FROM packs WHERE id = pack_id)
  );
```

- [ ] **Step 4: Verify — run this and confirm no error**

```sql
SELECT id, name, type FROM packs LIMIT 5;
SELECT id, sender_dog_id FROM messages LIMIT 5;
SELECT * FROM pack_join_requests LIMIT 1;
```

- [ ] **Step 5: Commit**

```bash
git commit --allow-empty -m "chore: apply schema migrations (packs.type, messages.sender_dog_id, pack_join_requests)"
```

---

## Task 2: Update `Pack` Type and `packService` Service Functions

**Files:**
- Modify: `src/services/packService.ts`

- [ ] **Step 1: Add `type` to the `Pack` type**

In `src/services/packService.ts`, update the `Pack` type (lines 3–8):

```typescript
export type Pack = {
  id: string;
  name: string;
  type: 'public' | 'semi_public' | 'private';
  created_by: string;
  created_at: string;
};
```

- [ ] **Step 2: Update `createPack` signature and body**

Replace the existing `createPack` function with:

```typescript
export async function createPack(
  name: string,
  creatorUserId: string,
  creatorDogId: string | null,
  type: 'public' | 'semi_public' | 'private',
  invitedFriends: { userId: string; dogId: string | null }[],
): Promise<Pack> {
  const { data: pack, error } = await supabase
    .from('packs')
    .insert({ name, created_by: creatorUserId, type })
    .select()
    .single();
  if (error) throw error;

  // Add creator + all invited friends as members
  const members = [
    { pack_id: pack.id, user_id: creatorUserId, dog_id: creatorDogId },
    ...invitedFriends.map((f) => ({ pack_id: pack.id, user_id: f.userId, dog_id: f.dogId })),
  ];
  await supabase.from('pack_members').insert(members);

  return pack;
}
```

- [ ] **Step 3: Update `sendPackMessage` to include `senderDogId`**

Replace the existing `sendPackMessage` function with:

```typescript
export async function sendPackMessage(
  packId: string,
  senderId: string,
  senderDogId: string | null,
  content: string,
): Promise<void> {
  const { error } = await supabase.from('messages').insert({
    pack_id: packId,
    sender_id: senderId,
    sender_dog_id: senderDogId,
    content,
  });
  if (error) throw error;
}
```

- [ ] **Step 4: Add `joinPack`, `createJoinRequest`, and `getPackMembers`**

First, confirm the `PackMemberInfo` type already exists in `packService.ts` (lines 10–15). It should be:

```typescript
export type PackMemberInfo = {
  userId: string;
  dogId: string | null;
  dogName: string;
  dogPhoto: string | null;
};
```

If it does not exist, add it. Then append these three functions to the end of `packService.ts`:

```typescript
export async function joinPack(
  packId: string,
  userId: string,
  dogId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('pack_members')
    .insert({ pack_id: packId, user_id: userId, dog_id: dogId });
  if (error) throw error;
}

export async function createJoinRequest(
  packId: string,
  userId: string,
  dogId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('pack_join_requests')
    .insert({ pack_id: packId, user_id: userId, dog_id: dogId });
  if (error) throw error;
}

export async function getPackMembers(packId: string): Promise<PackMemberInfo[]> {
  const { data, error } = await supabase
    .from('pack_members')
    .select('user_id, dog_id, dog:dogs!dog_id(name, photo_url)')
    .eq('pack_id', packId);
  if (error) throw error;
  return (data ?? []).map((m: any) => ({
    userId: m.user_id,
    dogId: m.dog_id ?? null,
    dogName: m.dog?.name ?? 'Unknown',
    dogPhoto: m.dog?.photo_url ?? null,
  }));
}
```

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/guyshik/DogPark && npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only in files that call the old `createPack`/`sendPackMessage` signatures (those will be fixed in later tasks). No errors inside `packService.ts` itself.

- [ ] **Step 6: Commit**

```bash
git add src/services/packService.ts
git commit -m "feat: update packService — type on Pack, new service functions"
```

---

## Task 3: Extend `searchService` to Return Packs

**Files:**
- Modify: `src/services/searchService.ts`

- [ ] **Step 1: Add `SearchPackResult` type and update `SearchResults`**

At the top of `searchService.ts`, after the existing type definitions, add:

```typescript
export type SearchPackResult = {
  type: 'pack';
  packId: string;
  packName: string;
  memberCount: number;
  packType: 'public' | 'semi_public';
};
```

Update `SearchResults` type:

```typescript
export type SearchResults = {
  dogs: SearchDogResult[];
  owners: SearchOwnerResult[];
  breeds: SearchBreedResult[];
  packs: SearchPackResult[];
};
```

- [ ] **Step 2: Update `searchAll` — add pack query and update return**

Replace the early return on line 36 with:
```typescript
if (query.length < 2) return { dogs: [], owners: [], breeds: [], packs: [] };
```

Change the `Promise.all` to include a pack query:

```typescript
const [{ data: dogsRaw }, { data: ownersRaw }, { data: packsRaw }] = await Promise.all([
  supabase
    .from('dogs')
    .select('id, name, breed, photo_url, owner:profiles!owner_id(id, name)')
    .or(`name.ilike.%${query}%,breed.ilike.%${query}%`)
    .neq('owner_id', currentUserId)
    .limit(20),
  supabase
    .from('profiles')
    .select('id, name, photo_url')
    .ilike('name', `%${query}%`)
    .neq('id', currentUserId)
    .limit(20),
  supabase
    .from('packs')
    .select('id, name, type, pack_members(count)')
    .ilike('name', `%${query}%`)
    .in('type', ['public', 'semi_public'])
    .limit(20),
]);
```

Add pack mapping before the `return` statement:

```typescript
const packs: SearchPackResult[] = (packsRaw ?? []).map((p: any) => ({
  type: 'pack',
  packId: p.id,
  packName: p.name,
  memberCount: p.pack_members?.[0]?.count ?? 0,
  packType: p.type,
}));
```

Update the return:

```typescript
return { dogs, owners, breeds, packs };
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/guyshik/DogPark && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `searchService.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/services/searchService.ts
git commit -m "feat: extend searchAll to return public/semi-public packs"
```

---

## Task 4: Add `type` Badge to `PackCard`

**Files:**
- Modify: `src/components/PackCard.tsx`

- [ ] **Step 1: Add `type` to the `Props` type**

```typescript
type Props = {
  packName: string;
  memberDogPhotos: string[];
  memberCount: number;
  lastMessage: string | null;
  hasLiveMember: boolean;
  unreadCount: number;
  packType: 'public' | 'semi_public' | 'private';
  onPress: () => void;
};
```

- [ ] **Step 2: Destructure `packType` in the component**

Update the function signature:

```typescript
export default function PackCard({
  packName,
  memberDogPhotos,
  memberCount,
  lastMessage,
  hasLiveMember,
  unreadCount,
  packType,
  onPress,
}: Props) {
```

- [ ] **Step 3: Add type badge rendering**

Add this helper above the `return` statement inside the component:

```typescript
const TYPE_LABEL: Record<typeof packType, string> = {
  public: '🌍 Public',
  semi_public: '🔓 Semi-public',
  private: '🔒 Private',
};
```

Inside the JSX, after the `memberCount` text, add:

```tsx
<View style={styles.typeBadge}>
  <Text style={styles.typeBadgeText}>{TYPE_LABEL[packType]}</Text>
</View>
```

- [ ] **Step 4: Add badge styles**

Add to `StyleSheet.create`:

```typescript
typeBadge: {
  alignSelf: 'flex-start',
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: borderRadius.sm,
  backgroundColor: colors.surfaceHigh,
  marginTop: 2,
},
typeBadgeText: {
  fontSize: 10,
  color: colors.textSecondary,
  fontWeight: '600',
},
```

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/guyshik/DogPark && npx tsc --noEmit 2>&1 | grep PackCard
```

Expected: error at the `PackCard` usage in `FriendsScreen` (missing `packType` prop) — this confirms the type is wired correctly and will be fixed next.

- [ ] **Step 6: Commit**

```bash
git add src/components/PackCard.tsx
git commit -m "feat: add pack type badge to PackCard"
```

---

## Task 5: Update Navigation Types and Existing Call Sites

**Files:**
- Modify: `src/navigation/AppTabs.tsx`
- Modify: `src/screens/friends/FriendsScreen.tsx`

- [ ] **Step 1: Update `FriendsStackParamList` in `AppTabs.tsx`**

Find line ~61 in `src/navigation/AppTabs.tsx`:

```typescript
// Before:
[Routes.PackChat]: { packId: string; packName: string };

// After:
[Routes.PackChat]: { packId: string; packName: string; memberCount: number };
```

- [ ] **Step 2: Fix the existing `PackCard` `onPress` call in `FriendsScreen.tsx`**

Find the `PackCard` usage in `FriendsScreen.tsx` (around line 251–259). Update the `onPress` and add `packType` prop:

```tsx
<PackCard
  packName={item.name}
  memberDogPhotos={item.members.slice(0, 3).map((m) => m.dogPhoto).filter(Boolean) as string[]}
  memberCount={item.members.length}
  lastMessage={null}
  hasLiveMember={false}
  unreadCount={0}
  packType={item.type}
  onPress={() => navigation.navigate('PackChat', {
    packId: item.id,
    packName: item.name,
    memberCount: item.members.length,
  })}
/>
```

- [ ] **Step 3: TypeScript check — should be clean**

```bash
cd /Users/guyshik/DogPark && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors (remaining errors will be from the placeholder screens, fixed in later tasks).

- [ ] **Step 4: Commit**

```bash
git add src/navigation/AppTabs.tsx src/screens/friends/FriendsScreen.tsx
git commit -m "feat: update PackChat nav params and PackCard call site"
```

---

## Task 6: CreatePackScreen

**Files:**
- Create: `src/screens/friends/CreatePackScreen.tsx`
- Modify: `src/navigation/AppTabs.tsx` (replace `CreatePackPlaceholder` with real screen)

- [ ] **Step 1: Create `CreatePackScreen.tsx`**

Create `src/screens/friends/CreatePackScreen.tsx`:

```typescript
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Image, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useDogStore } from '../../store/dogStore';
import { getFriends } from '../../services/friendService';
import { createPack } from '../../services/packService';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

type PackType = 'public' | 'semi_public' | 'private';

const TYPE_OPTIONS: { value: PackType; icon: string; label: string; description: string }[] = [
  { value: 'public', icon: '🌍', label: 'Public', description: 'Anyone can find and join' },
  { value: 'semi_public', icon: '🔓', label: 'Semi-public', description: 'Visible in search · Join needs approval' },
  { value: 'private', icon: '🔒', label: 'Private', description: 'Invite only · Not in search' },
];

export default function CreatePackScreen({ navigation }: { navigation: any }) {
  const { user } = useAuthStore();
  const { currentDog } = useDogStore();
  const activeDog = currentDog();
  const userId = user?.id ?? '';

  const [packName, setPackName] = useState('');
  const [packType, setPackType] = useState<PackType>('public');
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const { data: friends = [], isLoading } = useQuery({
    queryKey: ['friends', userId],
    queryFn: () => getFriends(activeDog ? [activeDog.id] : []),
    enabled: !!user,
  });

  function toggleFriend(friendshipId: string) {
    setSelectedFriendIds((prev) => {
      const next = new Set(prev);
      if (next.has(friendshipId)) next.delete(friendshipId);
      else next.add(friendshipId);
      return next;
    });
  }

  const isValid =
    packName.trim().length > 0 &&
    (packType !== 'private' || selectedFriendIds.size > 0);

  async function handleCreate() {
    if (!isValid || creating || !user) return;
    setCreating(true);
    try {
      const selectedFriends = friends
        .filter((f) => selectedFriendIds.has(f.id))
        .map((f) => ({ userId: f.friendDog.owner_id, dogId: f.friendDog.id }));

      const pack = await createPack(
        packName.trim(),
        userId,
        activeDog?.id ?? null,
        packType,
        selectedFriends,
      );
      navigation.replace('PackChat', {
        packId: pack.id,
        packName: pack.name,
        memberCount: selectedFriends.length + 1,
      });
    } catch (e) {
      console.error('[CreatePackScreen] createPack error:', e);
    } finally {
      setCreating(false);
    }
  }

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={handleCreate}
          disabled={!isValid || creating}
          style={{ marginRight: spacing.sm }}
        >
          {creating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.createBtn, !isValid && styles.createBtnDisabled]}>Create</Text>
          )}
        </TouchableOpacity>
      ),
    });
  }, [packName, packType, selectedFriendIds, creating]);

  return (
    <View style={styles.container}>
      {/* Pack name */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Pack Name</Text>
        <TextInput
          style={styles.nameInput}
          placeholder="e.g. Park Legends"
          placeholderTextColor={colors.textSecondary}
          value={packName}
          onChangeText={setPackName}
          autoFocus
          maxLength={40}
        />
      </View>

      {/* Pack type */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Type</Text>
        {TYPE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.typeRow, packType === opt.value && styles.typeRowSelected]}
            onPress={() => setPackType(opt.value)}
            activeOpacity={0.7}
          >
            <Text style={styles.typeIcon}>{opt.icon}</Text>
            <View style={styles.typeInfo}>
              <Text style={styles.typeLabel}>{opt.label}</Text>
              <Text style={styles.typeDesc}>{opt.description}</Text>
            </View>
            {packType === opt.value && (
              <View style={styles.radioSelected}>
                <Text style={{ fontSize: 10, color: '#fff' }}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Friend picker */}
      <View style={[styles.section, { flex: 1 }]}>
        <Text style={styles.sectionLabel}>
          Add Friends {packType === 'private' ? '(required)' : '(optional)'}
        </Text>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : friends.length === 0 ? (
          <Text style={styles.emptyFriends}>No friends yet — add some from Discover first.</Text>
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(f) => f.id}
            renderItem={({ item }) => {
              const selected = selectedFriendIds.has(item.id);
              return (
                <TouchableOpacity
                  style={styles.friendRow}
                  onPress={() => toggleFriend(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    {selected && <Text style={{ fontSize: 10, color: '#fff' }}>✓</Text>}
                  </View>
                  {item.friendDog?.photo_url ? (
                    <Image source={{ uri: item.friendDog.photo_url }} style={styles.friendAvatar} />
                  ) : (
                    <View style={[styles.friendAvatar, styles.friendAvatarPlaceholder]}>
                      <Text style={{ fontSize: 18 }}>🐶</Text>
                    </View>
                  )}
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendDogName}>{item.friendDog?.name ?? '?'}</Text>
                    <Text style={styles.friendOwnerName}>with {item.friendOwner.name}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  section: { paddingHorizontal: spacing.md, paddingTop: spacing.md, marginBottom: spacing.sm },
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  nameInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceHigh,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  typeRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  typeIcon: { fontSize: 22, marginRight: spacing.sm },
  typeInfo: { flex: 1 },
  typeLabel: { ...typography.body, fontWeight: '700', color: colors.text },
  typeDesc: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  radioSelected: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHigh,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  friendAvatar: { width: 40, height: 40, borderRadius: 12, marginRight: spacing.sm },
  friendAvatarPlaceholder: {
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendInfo: { flex: 1 },
  friendDogName: { ...typography.body, fontWeight: '700', color: colors.text },
  friendOwnerName: { ...typography.bodySmall, color: colors.textSecondary },
  emptyFriends: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  createBtn: { ...typography.body, color: colors.primary, fontWeight: '700' },
  createBtnDisabled: { color: colors.textSecondary },
});
```

- [ ] **Step 2: Wire `CreatePackScreen` into `AppTabs.tsx`**

In `src/navigation/AppTabs.tsx`:
1. Remove `function CreatePackPlaceholder()` and its styles
2. Add the import: `import CreatePackScreen from '../screens/friends/CreatePackScreen';`
3. Replace the `CreatePack` screen registration:

```typescript
<FriendsStack.Screen
  name={Routes.CreatePack}
  component={CreatePackScreen}
  options={{ title: 'Start a Pack' }}
/>
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/guyshik/DogPark && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in the new file or AppTabs.

- [ ] **Step 4: Manual smoke test**

In the simulator:
1. Go to Friends tab → Packs → "Start a Pack"
2. Verify: name input, type picker with 3 options, friends list
3. Select a friend, type a name, tap Create
4. Verify: navigates to PackChat (placeholder still, that's fine)

- [ ] **Step 5: Commit**

```bash
git add src/screens/friends/CreatePackScreen.tsx src/navigation/AppTabs.tsx
git commit -m "feat: implement CreatePackScreen with type picker and friend selector"
```

---

## Task 7: Add "+" Header Button to Packs Tab

**Files:**
- Modify: `src/screens/friends/FriendsScreen.tsx`

- [ ] **Step 1: Add `useLayoutEffect` to show/hide "+" button based on active tab**

In `FriendsScreen.tsx`, after the existing `useEffect` blocks, add:

```typescript
React.useLayoutEffect(() => {
  if (activeTab === 1) {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('CreatePack')}
          style={{ marginRight: spacing.sm }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={{ fontSize: 24, color: colors.primary }}>+</Text>
        </TouchableOpacity>
      ),
    });
  } else {
    navigation.setOptions({ headerRight: undefined });
  }
}, [activeTab]);
```

Make sure `spacing` is imported from `../../constants/theme` (it already is).

- [ ] **Step 2: Manual test**

1. Switch to Friends tab → swipe to Packs
2. Verify "+" appears in header
3. Switch back to Friends — "+" disappears
4. Tap "+" → CreatePack screen opens

- [ ] **Step 3: Commit**

```bash
git add src/screens/friends/FriendsScreen.tsx
git commit -m "feat: add + header button for creating packs in Packs tab"
```

---

## Task 8: PackChatScreen

**Files:**
- Create: `src/screens/chat/PackChatScreen.tsx`
- Modify: `src/navigation/AppTabs.tsx` (replace `PackChatPlaceholder`)

- [ ] **Step 1: Create `PackChatScreen.tsx`**

Create `src/screens/chat/PackChatScreen.tsx`:

```typescript
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useDogStore } from '../../store/dogStore';
import { sendPackMessage, getPackMembers, PackMemberInfo } from '../../services/packService';
import { supabase } from '../../lib/supabase';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

type Props = {
  route: { params: { packId: string; packName: string; memberCount: number } };
  navigation: any;
};

type PackMessage = {
  id: string;
  sender_id: string;
  sender_dog_id: string | null;
  content: string;
  created_at: string;
};

const AVATAR_SIZE = 32;

export default function PackChatScreen({ route, navigation }: Props) {
  const { packId, packName, memberCount } = route.params;
  const { user } = useAuthStore();
  const { currentDog } = useDogStore();
  const activeDog = currentDog();
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    navigation.setOptions({
      title: packName,
      headerBackTitle: 'Back',
      headerRight: () => (
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginRight: spacing.sm }}>
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </Text>
      ),
    });
  }, [packName, memberCount]);

  // Fetch pack members for dog name/photo lookup
  const { data: members = [] } = useQuery({
    queryKey: ['pack_members', packId],
    queryFn: () => getPackMembers(packId),
  });

  // Build dogId → { name, photo } map
  const memberMap = React.useMemo(() => {
    const map: Record<string, { name: string; photo: string | null }> = {};
    for (const m of members) {
      if (m.dogId) map[m.dogId] = { name: m.dogName, photo: m.dogPhoto };
    }
    return map;
  }, [members]);

  // Fetch messages
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['pack_messages', packId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, sender_dog_id, content, created_at')
        .eq('pack_id', packId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PackMessage[];
    },
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`pack_chat_${packId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `pack_id=eq.${packId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['pack_messages', packId] });
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[PackChatScreen] Realtime error:', err);
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [packId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!input.trim() || !user) return;
    setSending(true);
    const text = input.trim();
    setInput('');
    try {
      await sendPackMessage(packId, user.id, activeDog?.id ?? null, text);
      queryClient.invalidateQueries({ queryKey: ['pack_messages', packId] });
    } catch (e) {
      console.error('[PackChatScreen] sendPackMessage error:', e);
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item, index }: { item: PackMessage; index: number }) => {
    const isOwn = item.sender_id === user?.id;
    const prevItem = index > 0 ? messages[index - 1] : null;
    // Start of a streak: no previous message, or previous was from a different dog
    const isStreakStart =
      !prevItem ||
      (prevItem.sender_dog_id ?? prevItem.sender_id) !== (item.sender_dog_id ?? item.sender_id);

    if (isOwn) {
      return (
        <View style={styles.ownRow}>
          <View style={styles.ownBubble}>
            <Text style={styles.ownText}>{item.content}</Text>
          </View>
        </View>
      );
    }

    const dogInfo = item.sender_dog_id ? memberMap[item.sender_dog_id] : null;

    return (
      <View style={styles.theirRow}>
        {/* Avatar column — always occupies same width for alignment */}
        <View style={styles.avatarCol}>
          {isStreakStart ? (
            dogInfo?.photo ? (
              <Image source={{ uri: dogInfo.photo }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={{ fontSize: 16 }}>🐶</Text>
              </View>
            )
          ) : null}
        </View>
        <View style={styles.theirContent}>
          {isStreakStart && dogInfo && (
            <Text style={styles.senderName}>{dogInfo.name}</Text>
          )}
          <View style={[styles.theirBubble, !isStreakStart && styles.theirBubbleGrouped]}>
            <Text style={styles.theirText}>{item.content}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Be the first to woof 🐾</Text>
            </View>
          }
        />
      )}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Woof something..."
          placeholderTextColor={colors.textSecondary}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { ...typography.body, color: colors.textSecondary },
  messageList: { padding: spacing.md, paddingBottom: spacing.lg },
  ownRow: { alignItems: 'flex-end', marginBottom: 4 },
  ownBubble: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: '75%',
  },
  ownText: { ...typography.body, color: '#fff' },
  theirRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4 },
  avatarCol: {
    width: AVATAR_SIZE + spacing.sm,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginRight: 4,
  },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  theirContent: { flex: 1, maxWidth: '75%' },
  senderName: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: 3, marginLeft: 4 },
  theirBubble: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  theirBubbleGrouped: { borderTopLeftRadius: 16 },
  theirText: { ...typography.body, color: colors.text },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceHigh,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.surfaceHigh },
  sendBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
```

- [ ] **Step 2: Wire `PackChatScreen` into `AppTabs.tsx`**

1. Remove `function PackChatPlaceholder()` and the `placeholderStyles` object from `AppTabs.tsx`
2. Add import: `import PackChatScreen from '../screens/chat/PackChatScreen';`
3. Replace the `PackChat` screen registration:

```typescript
<FriendsStack.Screen
  name={Routes.PackChat}
  component={PackChatScreen}
  options={({ route }: any) => ({ title: route.params?.packName ?? 'Pack Chat' })}
/>
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/guyshik/DogPark && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

1. Create a pack (from Task 6) — should navigate straight to PackChatScreen
2. Send a message — verify it appears with dog name + avatar
3. Send two more messages in a row — verify only the first shows avatar/name
4. Verify KeyboardAvoidingView works (input stays above keyboard)

- [ ] **Step 5: Commit**

```bash
git add src/screens/chat/PackChatScreen.tsx src/navigation/AppTabs.tsx
git commit -m "feat: implement PackChatScreen with grouped sender messages"
```

---

## Task 9: Inline Search in FriendsScreen

**Files:**
- Modify: `src/screens/friends/FriendsScreen.tsx`

- [ ] **Step 1: Add search state and animation**

At the top of the `FriendsScreen` component, add:

```typescript
import { Animated, TextInput } from 'react-native'; // add these to existing RN import

const [searchActive, setSearchActive] = useState(false);
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState<SearchResults>({ dogs: [], owners: [], breeds: [], packs: [] });
const [searchLoading, setSearchLoading] = useState(false);
const [searched, setSearched] = useState(false);
const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const searchBarHeight = useRef(new Animated.Value(0)).current;
```

Add imports at the top of the file:

```typescript
import { searchAll, SearchResults } from '../../services/searchService';
```

- [ ] **Step 2: Add search activation functions**

```typescript
function openSearch() {
  setSearchActive(true);
  Animated.spring(searchBarHeight, {
    toValue: 1,
    useNativeDriver: false,
    damping: 18,
    stiffness: 160,
  }).start();
  navigation.setOptions({ headerRight: undefined }); // remove "+" button while searching
}

function closeSearch() {
  setSearchActive(false);
  setSearchQuery('');
  setSearchResults({ dogs: [], owners: [], breeds: [], packs: [] });
  setSearched(false);
  Animated.spring(searchBarHeight, {
    toValue: 0,
    useNativeDriver: false,
    damping: 18,
    stiffness: 160,
  }).start();
  // Restore "+" button if on Packs tab
  if (activeTab === 1) {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('CreatePack')} style={{ marginRight: spacing.sm }}>
          <Text style={{ fontSize: 24, color: colors.primary }}>+</Text>
        </TouchableOpacity>
      ),
    });
  }
}
```

- [ ] **Step 3: Add debounced search effect**

```typescript
useEffect(() => {
  if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  if (searchQuery.length < 2) {
    setSearchResults({ dogs: [], owners: [], breeds: [], packs: [] });
    setSearched(false);
    setSearchLoading(false);
    return;
  }
  setSearchLoading(true);
  searchDebounceRef.current = setTimeout(async () => {
    try {
      const r = await searchAll(searchQuery, userId);
      setSearchResults(r);
      setSearched(true);
    } catch {
      setSearchResults({ dogs: [], owners: [], breeds: [], packs: [] });
      setSearched(true);
    } finally {
      setSearchLoading(false);
    }
  }, 300);
  return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
}, [searchQuery, userId]);
```

- [ ] **Step 4: Add search icon to header**

**Important:** This step **replaces** the `useLayoutEffect` written in Task 7. Remove the Task 7 `useLayoutEffect` entirely and replace it with this single one that handles both the "+" button and the search icon:

```typescript
React.useLayoutEffect(() => {
  navigation.setOptions({
    headerRight: () => (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: spacing.sm }}>
        <TouchableOpacity onPress={openSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ fontSize: 20 }}>🔍</Text>
        </TouchableOpacity>
        {activeTab === 1 && (
          <TouchableOpacity onPress={() => navigation.navigate('CreatePack')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ fontSize: 24, color: colors.primary }}>+</Text>
          </TouchableOpacity>
        )}
      </View>
    ),
  });
}, [activeTab]);
```

- [ ] **Step 5: Add search bar JSX and results list**

Replace the `return` body's outermost `<View>` content. Wrap the existing segmented control in a conditional:

```tsx
return (
  <View style={styles.container}>
    {/* Animated search bar */}
    <Animated.View style={[styles.searchBarWrap, {
      maxHeight: searchBarHeight.interpolate({ inputRange: [0, 1], outputRange: [0, 56] }),
      opacity: searchBarHeight,
      overflow: 'hidden',
    }]}>
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search dogs, owners, breeds, packs..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchLoading && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 4 }} />}
        <TouchableOpacity onPress={closeSearch}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>

    {/* Normal content OR search results */}
    {searchActive ? (
      <SearchResultsList
        results={searchResults}
        searched={searched}
        query={searchQuery}
        userId={userId}
        activeDog={activeDog}
        navigation={navigation}
      />
    ) : (
      <>
        {/* Keep the existing SegmentedControl exactly as-is */}
        <SegmentedControl
          options={['Friends', 'Packs']}
          selectedIndex={activeTab}
          onChange={setActiveTab}
          style={{ margin: spacing.md, marginBottom: 0 }}
        />
        {/* Keep the existing activeTab === 0 / activeTab === 1 conditional exactly as-is */}
        {activeTab === 0 ? (
          friendsLoading ? (
            <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
          ) : (
            <FlatList
              {/* ... keep all existing FlatList props and renderItem unchanged ... */}
            />
          )
        ) : (
          <View style={{ flex: 1 }}>
            {packs.length === 0 ? (
              {/* ... keep existing empty state unchanged ... */}
            ) : (
              <FlatList
                {/* ... keep existing packs FlatList unchanged (PackCard call updated in Task 5) ... */}
              />
            )}
          </View>
        )}
      </>
    )}

    {/* Keep Toast exactly as-is */}
    <Toast message={toast.message} type={toast.type} visible={toast.visible} onHide={hideToast} />
  </View>
);
```

- [ ] **Step 6: Add `SearchResultsList` component (bottom of same file)**

First, add all required imports at the **top** of `FriendsScreen.tsx` (merge into existing import blocks — do NOT place imports after the export):

```typescript
// Add to existing react-native import:
import { Animated, TouchableWithoutFeedback, ScrollView } from 'react-native';

// Add to existing react import (ensure useRef is present):
import React, { useEffect, useMemo, useState, useRef } from 'react';

// Add to existing packService import:
import { getPacks, PackWithMembers, joinPack, createJoinRequest } from '../../services/packService';

// Add to existing searchService import:
import { searchAll, SearchResults, SearchPackResult } from '../../services/searchService';
```

Then add the `SearchResultsList` component below the main `FriendsScreen` export (no import statements here — they all go at the top):

```typescript

const SHEET_HEIGHT = 260;

function SearchResultsList({
  results, searched, query, userId, activeDog, navigation,
}: {
  results: SearchResults;
  searched: boolean;
  query: string;
  userId: string;
  activeDog: any;
  navigation: any;
}) {
  const [joinedPackIds, setJoinedPackIds] = useState<Set<string>>(new Set());
  const [requestedPackIds, setRequestedPackIds] = useState<Set<string>>(new Set());
  const [previewPack, setPreviewPack] = useState<SearchPackResult | null>(null);
  const sheetAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  function openPackPreview(pack: SearchPackResult) {
    setPreviewPack(pack);
    Animated.spring(sheetAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 160,
    }).start();
  }

  function closePackPreview() {
    Animated.spring(sheetAnim, {
      toValue: SHEET_HEIGHT,
      useNativeDriver: true,
      damping: 18,
      stiffness: 160,
    }).start(() => setPreviewPack(null));
  }

  const hasResults = results.dogs.length > 0 || results.owners.length > 0 ||
    results.breeds.length > 0 || results.packs.length > 0;

  async function handleJoin(pack: SearchPackResult) {
    try {
      await joinPack(pack.packId, userId, activeDog?.id ?? null);
      setJoinedPackIds((prev) => new Set([...prev, pack.packId]));
      navigation.navigate('PackChat', {
        packId: pack.packId,
        packName: pack.packName,
        memberCount: pack.memberCount + 1, // +1 for the user just joined
      });
    } catch (e) {
      console.error('[SearchResultsList] joinPack error:', e);
    }
  }

  async function handleRequest(packId: string) {
    try {
      await createJoinRequest(packId, userId, activeDog?.id ?? null);
      setRequestedPackIds((prev) => new Set([...prev, packId]));
    } catch (e) {
      console.error('[SearchResultsList] createJoinRequest error:', e);
    }
  }

  return (
    <>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {searched && !hasResults ? (
        <Text style={searchStyles.emptyText}>No results for "{query}"</Text>
      ) : null}

      {results.packs.length > 0 && (
        <View style={searchStyles.section}>
          <Text style={searchStyles.sectionHeader}>Packs</Text>
          {results.packs.map((pack) => (
            <TouchableOpacity
              key={pack.packId}
              style={searchStyles.resultRow}
              activeOpacity={0.7}
              onPress={() => openPackPreview(pack)}
            >
              <Text style={{ fontSize: 20, marginRight: spacing.sm }}>
                {pack.packType === 'public' ? '🌍' : '🔓'}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={searchStyles.resultName}>{pack.packName}</Text>
                <Text style={searchStyles.resultMeta}>
                  {pack.memberCount} {pack.memberCount === 1 ? 'member' : 'members'} ·{' '}
                  {pack.packType === 'public' ? 'Public' : 'Semi-public'}
                </Text>
              </View>
              {pack.packType === 'public' ? (
                <TouchableOpacity
                  style={searchStyles.actionBtn}
                  onPress={() => handleJoin(pack)}
                  disabled={joinedPackIds.has(pack.packId)}
                >
                  <Text style={searchStyles.actionBtnText}>
                    {joinedPackIds.has(pack.packId) ? 'Joined ✓' : 'Join'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[searchStyles.actionBtn, searchStyles.actionBtnOutline]}
                  onPress={() => handleRequest(pack.packId)}
                  disabled={requestedPackIds.has(pack.packId)}
                >
                  <Text style={[searchStyles.actionBtnText, searchStyles.actionBtnOutlineText]}>
                    {requestedPackIds.has(pack.packId) ? 'Requested ✓' : 'Request'}
                  </Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {results.dogs.length > 0 && (
        <View style={searchStyles.section}>
          <Text style={searchStyles.sectionHeader}>Dogs</Text>
          {results.dogs.map((dog) => (
            <View key={dog.dogId} style={searchStyles.resultRow}>
              <View style={searchStyles.avatarSmall}>
                {dog.dogPhoto
                  ? <Image source={{ uri: dog.dogPhoto }} style={searchStyles.avatarImg} />
                  : <Text style={{ fontSize: 20 }}>🐶</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={searchStyles.resultName}>{dog.dogName}</Text>
                {dog.dogBreed ? <Text style={searchStyles.resultMeta}>{dog.dogBreed}</Text> : null}
              </View>
              <Text style={searchStyles.resultMeta}>{dog.ownerName}</Text>
            </View>
          ))}
        </View>
      )}

      {results.owners.length > 0 && (
        <View style={searchStyles.section}>
          <Text style={searchStyles.sectionHeader}>Owners</Text>
          {results.owners.map((owner) => (
            <View key={owner.ownerId} style={searchStyles.resultRow}>
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
            </View>
          ))}
        </View>
      )}

      {results.breeds.length > 0 && (
        <View style={searchStyles.section}>
          <Text style={searchStyles.sectionHeader}>Breeds</Text>
          {results.breeds.map((breed) => (
            <View key={breed.breed} style={searchStyles.resultRow}>
              <View style={searchStyles.avatarSmall}>
                <Text style={{ fontSize: 20 }}>🐕</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={searchStyles.resultName}>{breed.breed}</Text>
                <Text style={searchStyles.resultMeta}>{breed.count} dogs</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>

    {/* Pack preview bottom sheet — sibling to ScrollView, both inside the <> fragment */}
    {/* Pack preview bottom sheet */}
    {previewPack && (
      <TouchableWithoutFeedback onPress={closePackPreview}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>
    )}
    <Animated.View
      style={[searchStyles.sheet, { transform: [{ translateY: sheetAnim }] }]}
      pointerEvents={previewPack ? 'auto' : 'none'}
    >
      {previewPack && (
        <View style={searchStyles.sheetInner}>
          <TouchableOpacity style={searchStyles.sheetClose} onPress={closePackPreview}>
            <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>✕</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 40, marginBottom: spacing.sm }}>
            {previewPack.packType === 'public' ? '🌍' : '🔓'}
          </Text>
          <Text style={[searchStyles.resultName, { fontSize: 20, marginBottom: 4 }]}>
            {previewPack.packName}
          </Text>
          <Text style={[searchStyles.resultMeta, { marginBottom: spacing.md }]}>
            {previewPack.memberCount} {previewPack.memberCount === 1 ? 'member' : 'members'} ·{' '}
            {previewPack.packType === 'public' ? 'Public' : 'Semi-public'}
          </Text>
          {previewPack.packType === 'public' ? (
            <TouchableOpacity
              style={[searchStyles.actionBtn, { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }]}
              onPress={() => { closePackPreview(); handleJoin(previewPack); }}
              disabled={joinedPackIds.has(previewPack.packId)}
            >
              <Text style={searchStyles.actionBtnText}>
                {joinedPackIds.has(previewPack.packId) ? 'Joined ✓' : 'Join Pack'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[searchStyles.actionBtn, searchStyles.actionBtnOutline, { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }]}
              onPress={() => { closePackPreview(); handleRequest(previewPack.packId); }}
              disabled={requestedPackIds.has(previewPack.packId)}
            >
              <Text style={[searchStyles.actionBtnText, searchStyles.actionBtnOutlineText]}>
                {requestedPackIds.has(previewPack.packId) ? 'Request Sent ✓' : 'Request to Join'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </Animated.View>
    </>
  );
}

const searchStyles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  sectionHeader: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHigh,
  },
  resultName: { ...typography.body, fontWeight: '700', color: colors.text },
  resultMeta: { ...typography.bodySmall, color: colors.textSecondary },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xxl },
  avatarSmall: {
    width: 40, height: 40, borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceHigh, justifyContent: 'center',
    alignItems: 'center', marginRight: spacing.sm, overflow: 'hidden',
  },
  avatarImg: { width: 40, height: 40 },
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  actionBtnText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  actionBtnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  actionBtnOutlineText: { color: colors.primary },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  sheetInner: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
  sheetClose: {
    position: 'absolute', top: spacing.md, right: spacing.md,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center', alignItems: 'center',
  },
});
```

Also add these styles to the main `FriendsScreen` `StyleSheet.create`:

```typescript
searchBarWrap: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
searchBar: {
  flexDirection: 'row', alignItems: 'center',
  backgroundColor: colors.surfaceHigh,
  borderRadius: borderRadius.lg,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  borderWidth: 1, borderColor: colors.border,
},
searchIcon: { fontSize: 16, marginRight: 6 },
searchInput: { flex: 1, ...typography.body, color: colors.text, paddingVertical: 0 },
cancelText: { ...typography.body, color: colors.primary, fontWeight: '600', marginLeft: spacing.sm },
```

- [ ] **Step 7: TypeScript check**

```bash
cd /Users/guyshik/DogPark && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 8: Manual smoke test**

1. Go to Friends tab → tap 🔍
2. Verify: segmented control and "+" hidden, search bar appears
3. Type 2+ characters → verify results appear (dogs, owners, breeds, packs)
4. Tap Cancel → verify returns to normal Friends/Packs view
5. Type a pack name → verify public pack shows "Join", semi-public shows "Request"
6. Tap Join on a public pack → verify navigates to PackChat

- [ ] **Step 9: Commit**

```bash
git add src/screens/friends/FriendsScreen.tsx
git commit -m "feat: add inline search to FriendsScreen with pack results"
```

---

## Task 10: Remove SearchOverlay from DiscoverScreen

**Files:**
- Modify: `src/screens/discover/DiscoverScreen.tsx`

- [ ] **Step 1: Remove SearchOverlay**

In `src/screens/discover/DiscoverScreen.tsx`:
1. Remove the `import SearchOverlay from '../../components/SearchOverlay';` line
2. Find the `<SearchOverlay ... />` JSX element and remove it
3. Find any state variable controlling the overlay visibility (e.g. `searchVisible`, `showSearch`) and remove it along with the setter call
4. Find any button/icon that was used to open the search overlay and remove it or repurpose it

- [ ] **Step 2: TypeScript check — full clean**

```bash
cd /Users/guyshik/DogPark && npx tsc --noEmit 2>&1
```

Expected: zero errors.

- [ ] **Step 3: Manual smoke test**

1. Go to Discover tab — confirm no search icon/button pointing to the old overlay
2. Go to Friends tab — confirm search still works correctly
3. Full flow: search → find a pack → join → verify pack appears in Packs tab

- [ ] **Step 4: Final commit**

```bash
git add src/screens/discover/DiscoverScreen.tsx
git commit -m "feat: remove SearchOverlay from Discover — search now lives in Friends"
```

---

## Done ✓

All features shipped:
- ✅ Inline search in Friends (dogs, owners, breeds, packs)
- ✅ Pack types (public / semi-public / private) with join/request flows
- ✅ CreatePack screen with type picker and friend selector
- ✅ PackChatScreen with grouped sender messages
- ✅ SearchOverlay removed from Discover
