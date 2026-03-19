# Pack Join Request Approval — Design Spec
Date: 2026-03-19

## Overview

Add a join request approval UI so Pack Leaders can review, approve, and dismiss requests to join semi-public packs. Includes a role system (Pack Leader / Member) and a dedicated management screen accessible from PackChatScreen.

---

## 1. Roles

Two roles stored as a `role` column on `pack_members`:

| Role | Who | Powers |
|---|---|---|
| Pack Leader | Creator (automatic) + promoted members | View/approve/dismiss join requests, promote members to Pack Leader |
| Member | Everyone else | Regular pack member, no admin powers |

- The pack creator is inserted as `role: 'leader'` during `createPack`
- Any Pack Leader can promote a member to Pack Leader via `updateMemberRole`
- No demotion feature — only promotion. This means once someone is a Pack Leader, they stay one.
- The existing `joinPack` function (for public packs) inserts without `role` — the column default `'member'` handles this correctly, no change needed.

---

## 2. PackRequestsScreen

New screen: `src/screens/friends/PackRequestsScreen.tsx`

### Navigation
- Add `PackRequests: 'PackRequests'` to `src/constants/routes.ts`
- Add `[Routes.PackRequests]: { packId: string; packName: string }` to `FriendsStackParamList` in `AppTabs.tsx`
- Register the screen in the `FriendsNavigator` stack
- Accessible from: PackChatScreen header badge (Pack Leaders only)

### Layout (top to bottom)

**Header:** "Pack Requests" as title, pack name as subtitle

**Section 1 — Pending Requests**
- Section header: "Pending Requests (N)"
- Each row: dog photo (36×36, rounded), dog name, "with {ownerName}", Approve button (primary fill) + Dismiss button (grey fill)
- Approve: inserts `pack_members` row with `role: 'member'`, updates request status to `'approved'`, sends push notification, removes row from list
- Dismiss: deletes the `pack_join_requests` row (user can re-request), removes row from list
- Empty state: "No pending requests 🐾"

**Section 2 — Pack Members**
- Section header: "Pack Members (N)"
- Each row: dog photo (36×36, rounded), dog name, "with {ownerName}"
- Pack Leaders: show "🐕 Pack Leader" badge next to name, no action button
- Regular members: show "Make Leader" outline button (only visible to Pack Leaders)
- Tapping "Make Leader": updates `pack_members.role` to `'leader'`, badge appears immediately

---

## 3. PackChatScreen Changes

- Pack Leaders see a badge in the header: "N pending →" (primary background, white text)
- Badge only appears when there are pending requests AND the current user is a Pack Leader
- Tapping the badge navigates to `PackRequests` screen with `{ packId, packName }`
- Non-leaders see no badge — just the existing member count
- Add a `useQuery` for pending request count (with `refetchInterval: 15000`) and an `isPackLeader` check
- The existing `useEffect` that calls `navigation.setOptions` must add these query results to its dependency array so the header updates when the count changes or leader status is resolved

---

## 4. Data Model Changes

| Table | Change |
|---|---|
| `pack_members` | Add `role` column: `'leader' \| 'member'`, default `'member'` |

### RLS Policies Needed

| Policy | Table | Rule |
|---|---|---|
| Leaders can update request status | `pack_join_requests` | `FOR UPDATE USING (auth.uid() IN (SELECT user_id FROM pack_members WHERE pack_id = pack_join_requests.pack_id AND role = 'leader'))` |
| Leaders can delete requests | `pack_join_requests` | `FOR DELETE USING (auth.uid() IN (SELECT user_id FROM pack_members WHERE pack_id = pack_join_requests.pack_id AND role = 'leader'))` |
| Leaders can insert members on approval | `pack_members` | `FOR INSERT WITH CHECK (auth.uid() IN (SELECT user_id FROM pack_members pm2 WHERE pm2.pack_id = pack_members.pack_id AND pm2.role = 'leader'))` |
| Leaders can update member roles | `pack_members` | `FOR UPDATE USING (auth.uid() IN (SELECT user_id FROM pack_members pm2 WHERE pm2.pack_id = pack_members.pack_id AND pm2.role = 'leader'))` |

Note: the existing `pack_members` INSERT policy (`auth.uid() = user_id` — users inserting themselves) must remain for `joinPack` (public packs). The new leader INSERT policy is an additional policy.

---

## 5. New / Updated Service Functions

| Function | Location | Description |
|---|---|---|
| `getPendingRequests(packId)` | `packService.ts` | Query `pack_join_requests` where `status = 'pending'`, joined with `dogs` (name, photo_url) and `profiles` (name). Returns `PendingRequest[]` |
| `approveJoinRequest(requestId, packId, userId, dogId)` | `packService.ts` | Insert `pack_members` row with `role: 'member'` first, then update request status to `'approved'`. If the insert succeeds but the status update fails, the user is still a member (acceptable — the request just stays pending and can be cleaned up). Finally, call the push notification function. Each step is a separate Supabase call — no RPC needed. |
| `dismissJoinRequest(requestId)` | `packService.ts` | Delete the `pack_join_requests` row |
| `updateMemberRole(packId, userId, role)` | `packService.ts` | Update `pack_members.role` WHERE `pack_id = packId AND user_id = userId`. The `userId` param identifies the member (not the `pack_members.id` primary key). |
| `getPackMembersWithRoles(packId)` | `packService.ts` | Like `getPackMembers` but also returns `role` field. Returns `PackMemberWithRole[]` |
| `getPendingRequestCount(packId)` | `packService.ts` | Returns count of pending requests — lightweight query for the badge |
| `isPackLeader(packId, userId)` | `packService.ts` | Returns boolean — checks if user has `role = 'leader'` in `pack_members` |
| `createPack` (update) | `packService.ts` | Creator's `pack_members` row inserted with `role: 'leader'` instead of default |

### New Types

```typescript
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

export type PackMemberWithRole = PackMemberInfo & {
  role: 'leader' | 'member';
};
```

---

## 6. Push Notification

The existing `send-push` Supabase edge function is hardwired to the DM message flow (expects `friendship_id`). For pack approval notifications, extend the edge function to accept an alternative payload shape:

```typescript
// New optional payload path:
{ type: 'pack_approval', userId: string, title: string, body: string }
```

When `type === 'pack_approval'`, the function looks up the user's push token by `userId` and sends the notification with the provided title/body. The existing DM path remains unchanged.

- Title: pack name
- Body: "Your dog {dogName} was accepted into {packName}! 🎉"

---

## 7. Out of Scope

- Demoting Pack Leaders
- Removing members from a pack
- Leaving a pack
- Notification for dismissed requests
- Request approval from within push notification (deep linking)
