# Pack Join Request Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Pack Leaders approve/dismiss join requests and promote members to Pack Leader, via a dedicated PackRequestsScreen accessible from PackChatScreen.

**Architecture:** Schema first (role column + RLS), then service functions, then extend send-push edge function, then PackRequestsScreen, then wire PackChatScreen badge, then navigation + route registration.

**Tech Stack:** React Native (Expo), Supabase (postgres + realtime + edge functions), React Navigation, @tanstack/react-query, TypeScript

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Modify | `src/services/packService.ts` | Add role types, new service functions (approve, dismiss, promote, queries) |
| Modify | `src/constants/routes.ts` | Add `PackRequests` route constant |
| Modify | `src/navigation/AppTabs.tsx` | Add `PackRequests` to `FriendsStackParamList`, register screen |
| Modify | `src/screens/chat/PackChatScreen.tsx` | Add pending-requests badge for Pack Leaders |
| Create | `src/screens/friends/PackRequestsScreen.tsx` | New screen: pending requests + members with role management |
| Modify | `supabase/functions/send-push/index.ts` | Extend to handle `pack_approval` notification type |

---

## Task 1: Schema Migration — Add `role` Column to `pack_members`

Run in Supabase SQL Editor (no code files changed).

- [ ] **Step 1: Add `role` column**

```sql
ALTER TABLE pack_members
ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member'
CHECK (role IN ('leader', 'member'));
```

- [ ] **Step 2: Set existing creators as leaders**

```sql
UPDATE pack_members pm
SET role = 'leader'
FROM packs p
WHERE pm.pack_id = p.id
  AND pm.user_id = p.created_by;
```

- [ ] **Step 3: Add RLS policies**

```sql
-- Leaders can update join request status for their packs
CREATE POLICY "Leaders can update join requests"
  ON pack_join_requests FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM pack_members
      WHERE pack_id = pack_join_requests.pack_id AND role = 'leader'
    )
  );

-- Leaders can delete join requests (dismiss)
CREATE POLICY "Leaders can delete join requests"
  ON pack_join_requests FOR DELETE
  USING (
    auth.uid() IN (
      SELECT user_id FROM pack_members
      WHERE pack_id = pack_join_requests.pack_id AND role = 'leader'
    )
  );

-- Leaders can insert new members (on approval)
CREATE POLICY "Leaders can add pack members"
  ON pack_members FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM pack_members pm2
      WHERE pm2.pack_id = pack_members.pack_id AND pm2.role = 'leader'
    )
  );

-- Leaders can update member roles
CREATE POLICY "Leaders can update member roles"
  ON pack_members FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM pack_members pm2
      WHERE pm2.pack_id = pack_members.pack_id AND pm2.role = 'leader'
    )
  );
```

- [ ] **Step 4: Verify**

```sql
SELECT pm.user_id, pm.role, p.name
FROM pack_members pm
JOIN packs p ON p.id = pm.pack_id
ORDER BY p.name, pm.role;
```

Confirm creators show `role = 'leader'`.

---

## Task 2: Add Types and Service Functions to `packService.ts`

**Files:**
- Modify: `src/services/packService.ts`

- [ ] **Step 1: Add new types after existing `PackMemberInfo`**

```typescript
export type PackMemberWithRole = PackMemberInfo & {
  role: 'leader' | 'member';
};

export type PendingRequest = {
  id: string;
  packId: string;
  userId: string;
  dogId: string | null;
  dogName: string;
  dogPhoto: string | null;
  ownerName: string;
  createdAt: string;
};
```

- [ ] **Step 2: Update `createPack` — creator gets `role: 'leader'`**

In the `createPack` function, change the creator's member insert (line 84) from:

```typescript
{ pack_id: pack.id, user_id: creatorUserId, dog_id: creatorDogId },
```

to:

```typescript
{ pack_id: pack.id, user_id: creatorUserId, dog_id: creatorDogId, role: 'leader' },
```

Invited friends stay as default (`role` omitted = `'member'`).

- [ ] **Step 3: Add `getPackMembersWithRoles` function**

```typescript
export async function getPackMembersWithRoles(packId: string): Promise<PackMemberWithRole[]> {
  const { data, error } = await supabase
    .from('pack_members')
    .select('user_id, dog_id, role, dog:dogs!dog_id(name, photo_url)')
    .eq('pack_id', packId);
  if (error) throw error;
  return (data ?? []).map((m: any) => ({
    userId: m.user_id,
    dogId: m.dog_id ?? null,
    dogName: m.dog?.name ?? 'Unknown',
    dogPhoto: m.dog?.photo_url ?? null,
    role: m.role ?? 'member',
  }));
}
```

- [ ] **Step 4: Add `isPackLeader` function**

```typescript
export async function isPackLeader(packId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('pack_members')
    .select('role')
    .eq('pack_id', packId)
    .eq('user_id', userId)
    .single();
  if (error) return false;
  return data?.role === 'leader';
}
```

- [ ] **Step 5: Add `getPendingRequests` function**

```typescript
export async function getPendingRequests(packId: string): Promise<PendingRequest[]> {
  const { data, error } = await supabase
    .from('pack_join_requests')
    .select('id, pack_id, user_id, dog_id, created_at, dog:dogs!dog_id(name, photo_url), owner:profiles!user_id(name)')
    .eq('pack_id', packId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    packId: r.pack_id,
    userId: r.user_id,
    dogId: r.dog_id ?? null,
    dogName: r.dog?.name ?? 'Unknown',
    dogPhoto: r.dog?.photo_url ?? null,
    ownerName: r.owner?.name ?? 'Unknown',
    createdAt: r.created_at,
  }));
}
```

- [ ] **Step 6: Add `getPendingRequestCount` function**

```typescript
export async function getPendingRequestCount(packId: string): Promise<number> {
  const { count, error } = await supabase
    .from('pack_join_requests')
    .select('id', { count: 'exact', head: true })
    .eq('pack_id', packId)
    .eq('status', 'pending');
  if (error) return 0;
  return count ?? 0;
}
```

- [ ] **Step 7: Add `approveJoinRequest` function**

```typescript
export async function approveJoinRequest(
  requestId: string,
  packId: string,
  userId: string,
  dogId: string | null,
): Promise<void> {
  // 1. Add as member first (most important step)
  const { error: memberError } = await supabase
    .from('pack_members')
    .insert({ pack_id: packId, user_id: userId, dog_id: dogId, role: 'member' });
  if (memberError) throw memberError;

  // 2. Update request status
  await supabase
    .from('pack_join_requests')
    .update({ status: 'approved' })
    .eq('id', requestId);

  // 3. Send push notification (best-effort)
  try {
    await supabase.functions.invoke('send-push', {
      body: { type: 'pack_approval', userId, packId },
    });
  } catch (e) {
    console.warn('[approveJoinRequest] push notification failed:', e);
  }
}
```

- [ ] **Step 8: Add `dismissJoinRequest` function**

```typescript
export async function dismissJoinRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('pack_join_requests')
    .delete()
    .eq('id', requestId);
  if (error) throw error;
}
```

- [ ] **Step 9: Add `updateMemberRole` function**

```typescript
export async function updateMemberRole(
  packId: string,
  userId: string,
  role: 'leader' | 'member',
): Promise<void> {
  const { error } = await supabase
    .from('pack_members')
    .update({ role })
    .eq('pack_id', packId)
    .eq('user_id', userId);
  if (error) throw error;
}
```

- [ ] **Step 10: TypeScript check**

```bash
cd /Users/guyshik/DogPark && npx tsc --noEmit 2>&1 | grep packService
```

Expected: same pre-existing errors only, no new ones.

- [ ] **Step 11: Commit**

```bash
git add src/services/packService.ts
git commit -m "feat: add pack role types and leader service functions"
```

---

## Task 3: Extend `send-push` Edge Function

**Files:**
- Modify: `supabase/functions/send-push/index.ts`

- [ ] **Step 1: Add pack approval handler**

Replace the entire `serve` handler with:

```typescript
serve(async (req) => {
  try {
    const payload = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // --- Pack approval notification ---
    if (payload.type === 'pack_approval') {
      const { userId, packId } = payload;
      if (!userId || !packId) return new Response('missing userId or packId', { status: 400 });

      const [{ data: profile }, { data: pack }, { data: dog }] = await Promise.all([
        supabase.from('profiles').select('push_token').eq('id', userId).single(),
        supabase.from('packs').select('name').eq('id', packId).single(),
        supabase.from('pack_members').select('dog_id').eq('pack_id', packId).eq('user_id', userId).single()
          .then(async ({ data: member }) => {
            if (!member?.dog_id) return { data: null };
            return supabase.from('dogs').select('name').eq('id', member.dog_id).single();
          }),
      ]);

      if (!profile?.push_token) return new Response('no token', { status: 200 });

      const dogName = dog?.name ?? 'Your dog';
      const packName = pack?.name ?? 'a pack';

      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: profile.push_token,
          title: packName,
          body: `${dogName} was accepted into ${packName}! 🎉`,
          sound: 'default',
          channelId: 'messages',
        }),
      });

      return new Response('ok', { status: 200 });
    }

    // --- Existing DM message notification ---
    const { record } = payload;
    if (!record?.friendship_id || !record?.sender_id || !record?.content) {
      return new Response('invalid payload', { status: 400 });
    }

    const { data: friendship } = await supabase
      .from('friendships')
      .select('user_a, user_b, dog_a, dog_b')
      .eq('id', record.friendship_id)
      .single();

    if (!friendship) return new Response('friendship not found', { status: 404 });

    const recipientUserId =
      friendship.user_a === record.sender_id ? friendship.user_b : friendship.user_a;

    const senderDogId =
      friendship.user_a === record.sender_id ? friendship.dog_a : friendship.dog_b;
    const { data: senderDog } = await supabase
      .from('dogs')
      .select('name')
      .eq('id', senderDogId)
      .single();

    const { data: profile } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', recipientUserId)
      .single();

    if (!profile?.push_token) return new Response('no token', { status: 200 });

    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: profile.push_token,
        title: senderDog?.name ?? 'New message',
        body: record.content,
        sound: 'default',
        channelId: 'messages',
      }),
    });

    return new Response('ok', { status: 200 });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/send-push/index.ts
git commit -m "feat: extend send-push to handle pack approval notifications"
```

---

## Task 4: Add Route and Navigation Registration

**Files:**
- Modify: `src/constants/routes.ts`
- Modify: `src/navigation/AppTabs.tsx`

- [ ] **Step 1: Add `PackRequests` to `routes.ts`**

Add before the closing `} as const;`:

```typescript
PackRequests: 'PackRequests',
```

- [ ] **Step 2: Update `FriendsStackParamList` in `AppTabs.tsx`**

Add to the type:

```typescript
[Routes.PackRequests]: { packId: string; packName: string };
```

- [ ] **Step 3: Import and register `PackRequestsScreen` in `AppTabs.tsx`**

Add import at top:

```typescript
import PackRequestsScreen from '../screens/friends/PackRequestsScreen';
```

Add screen registration inside `FriendsNavigator`, after the `CreatePack` screen:

```typescript
<FriendsStack.Screen
  name={Routes.PackRequests}
  component={PackRequestsScreen}
  options={{ title: 'Pack Requests' }}
/>
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/guyshik/DogPark && npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: will have an error about `PackRequestsScreen` not existing yet — that's fine, it's created in Task 5.

- [ ] **Step 5: Commit**

```bash
git add src/constants/routes.ts src/navigation/AppTabs.tsx
git commit -m "feat: add PackRequests route and navigation registration"
```

---

## Task 5: Create `PackRequestsScreen`

**Files:**
- Create: `src/screens/friends/PackRequestsScreen.tsx`

- [ ] **Step 1: Create the screen**

```typescript
import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, SectionList,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
  getPendingRequests, getPackMembersWithRoles,
  approveJoinRequest, dismissJoinRequest, updateMemberRole,
  PendingRequest, PackMemberWithRole,
} from '../../services/packService';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

type Props = {
  route: { params: { packId: string; packName: string } };
  navigation: any;
};

export default function PackRequestsScreen({ route, navigation }: Props) {
  const { packId, packName } = route.params;
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    navigation.setOptions({
      title: 'Pack Requests',
      headerRight: () => (
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginRight: spacing.sm }}>
          {packName}
        </Text>
      ),
    });
  }, [packName]);

  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['pack_requests', packId],
    queryFn: () => getPendingRequests(packId),
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['pack_members_roles', packId],
    queryFn: () => getPackMembersWithRoles(packId),
  });

  function addProcessing(id: string) {
    setProcessingIds((prev) => new Set([...prev, id]));
  }

  function removeProcessing(id: string) {
    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleApprove(req: PendingRequest) {
    addProcessing(req.id);
    try {
      await approveJoinRequest(req.id, req.packId, req.userId, req.dogId);
      queryClient.invalidateQueries({ queryKey: ['pack_requests', packId] });
      queryClient.invalidateQueries({ queryKey: ['pack_members_roles', packId] });
      queryClient.invalidateQueries({ queryKey: ['pack_members', packId] });
    } catch (e) {
      console.error('[PackRequestsScreen] approve error:', e);
    } finally {
      removeProcessing(req.id);
    }
  }

  async function handleDismiss(req: PendingRequest) {
    addProcessing(req.id);
    try {
      await dismissJoinRequest(req.id);
      queryClient.invalidateQueries({ queryKey: ['pack_requests', packId] });
    } catch (e) {
      console.error('[PackRequestsScreen] dismiss error:', e);
    } finally {
      removeProcessing(req.id);
    }
  }

  async function handlePromote(member: PackMemberWithRole) {
    addProcessing(member.userId);
    try {
      await updateMemberRole(packId, member.userId, 'leader');
      queryClient.invalidateQueries({ queryKey: ['pack_members_roles', packId] });
    } catch (e) {
      console.error('[PackRequestsScreen] promote error:', e);
    } finally {
      removeProcessing(member.userId);
    }
  }

  const isLoading = requestsLoading || membersLoading;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <>
            {/* Pending Requests Section */}
            <Text style={styles.sectionHeader}>
              Pending Requests ({requests.length})
            </Text>
            {requests.length === 0 ? (
              <Text style={styles.emptyText}>No pending requests 🐾</Text>
            ) : (
              requests.map((req) => (
                <View key={req.id} style={styles.row}>
                  {req.dogPhoto ? (
                    <Image source={{ uri: req.dogPhoto }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Text style={{ fontSize: 18 }}>🐶</Text>
                    </View>
                  )}
                  <View style={styles.info}>
                    <Text style={styles.name}>{req.dogName}</Text>
                    <Text style={styles.meta}>with {req.ownerName}</Text>
                  </View>
                  {processingIds.has(req.id) ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={styles.approveBtn}
                        onPress={() => handleApprove(req)}
                      >
                        <Text style={styles.approveBtnText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.dismissBtn}
                        onPress={() => handleDismiss(req)}
                      >
                        <Text style={styles.dismissBtnText}>Dismiss</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}

            {/* Members Section */}
            <Text style={[styles.sectionHeader, { marginTop: spacing.lg }]}>
              Pack Members ({members.length})
            </Text>
            {members.map((member) => (
              <View key={member.userId} style={styles.row}>
                {member.dogPhoto ? (
                  <Image source={{ uri: member.dogPhoto }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={{ fontSize: 18 }}>🐶</Text>
                  </View>
                )}
                <View style={styles.info}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.name}>{member.dogName}</Text>
                    {member.role === 'leader' && (
                      <View style={styles.leaderBadge}>
                        <Text style={styles.leaderBadgeText}>🐕 Pack Leader</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.meta}>with {member.userId === user?.id ? 'you' : '...'}</Text>
                </View>
                {member.role !== 'leader' && (
                  processingIds.has(member.userId) ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <TouchableOpacity
                      style={styles.promoteBtn}
                      onPress={() => handlePromote(member)}
                    >
                      <Text style={styles.promoteBtnText}>Make Leader</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            ))}
          </>
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  list: { padding: spacing.md },
  sectionHeader: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHigh,
    gap: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: { flex: 1 },
  name: { ...typography.body, fontWeight: '700', color: colors.text },
  meta: { ...typography.bodySmall, color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: 6 },
  approveBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  approveBtnText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  dismissBtn: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  dismissBtnText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  promoteBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  promoteBtnText: { fontSize: 10, color: colors.primary, fontWeight: '600' },
  leaderBadge: {
    backgroundColor: colors.primary + '22',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  leaderBadgeText: { fontSize: 10, color: colors.primary, fontWeight: '600' },
});
```

**Note on owner name:** The `getPackMembersWithRoles` function doesn't return `ownerName`. For the members list, showing "with you" for the current user and the dog name for others is sufficient. To show full owner names, the `getPackMembersWithRoles` query would need to join `profiles` — but this is a stretch goal. The pending requests already include `ownerName` from the `getPendingRequests` join.

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/guyshik/DogPark && npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: same 127 pre-existing errors, no new ones.

- [ ] **Step 3: Commit**

```bash
git add src/screens/friends/PackRequestsScreen.tsx
git commit -m "feat: create PackRequestsScreen with approve/dismiss and role management"
```

---

## Task 6: Add Pending Badge to `PackChatScreen`

**Files:**
- Modify: `src/screens/chat/PackChatScreen.tsx`

- [ ] **Step 1: Add imports**

Add to the existing packService import:

```typescript
import { sendPackMessage, getPackMembers, PackMemberInfo, isPackLeader, getPendingRequestCount } from '../../services/packService';
```

- [ ] **Step 2: Add leader and pending count queries**

After the existing `members` query (line 54), add:

```typescript
const { data: userIsLeader = false } = useQuery({
  queryKey: ['is_pack_leader', packId, user?.id],
  queryFn: () => isPackLeader(packId, user!.id),
  enabled: !!user,
});

const { data: pendingCount = 0 } = useQuery({
  queryKey: ['pending_request_count', packId],
  queryFn: () => getPendingRequestCount(packId),
  enabled: !!user && userIsLeader,
  refetchInterval: 15000,
});
```

- [ ] **Step 3: Update the `useEffect` that sets header options**

Replace the existing `useEffect` (lines 38-48) with:

```typescript
useEffect(() => {
  navigation.setOptions({
    title: packName,
    headerBackTitle: 'Back',
    headerRight: () => (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: spacing.sm }}>
        {userIsLeader && pendingCount > 0 && (
          <TouchableOpacity
            style={{ backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}
            onPress={() => navigation.navigate('PackRequests', { packId, packName })}
          >
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{pendingCount} pending →</Text>
          </TouchableOpacity>
        )}
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </Text>
      </View>
    ),
  });
}, [packName, memberCount, userIsLeader, pendingCount]);
```

Add `View` to the react-native import if not already there (it is).

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/guyshik/DogPark && npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: 127 pre-existing errors, no new ones.

- [ ] **Step 5: Commit**

```bash
git add src/screens/chat/PackChatScreen.tsx
git commit -m "feat: add pending requests badge to PackChatScreen header for leaders"
```

---

## Done ✓

All features shipped:
- ✅ `role` column on `pack_members` (leader/member)
- ✅ Creator automatically set as Pack Leader
- ✅ Service functions: approve, dismiss, promote, query pending, check leader
- ✅ Push notification on approval via extended `send-push` edge function
- ✅ PackRequestsScreen with pending requests and member management
- ✅ PackChatScreen badge for Pack Leaders
- ✅ Navigation route registered
