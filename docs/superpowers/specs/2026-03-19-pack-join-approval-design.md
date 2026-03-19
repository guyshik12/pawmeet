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
- No demotion — keep it simple for now
- Cannot demote or remove the original creator

---

## 2. PackRequestsScreen

New screen: `src/screens/friends/PackRequestsScreen.tsx`

### Navigation
- Route: `PackRequests` added to `FriendsStackParamList`
- Params: `{ packId: string; packName: string }`
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
- Use `isPackLeader(packId, userId)` to determine visibility
- Use a query for pending request count with `refetchInterval` to keep badge updated

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
| Leaders can update member roles | `pack_members` | `FOR UPDATE USING (auth.uid() IN (SELECT user_id FROM pack_members pm2 WHERE pm2.pack_id = pack_members.pack_id AND pm2.role = 'leader'))` |

---

## 5. New / Updated Service Functions

| Function | Location | Description |
|---|---|---|
| `getPendingRequests(packId)` | `packService.ts` | Query `pack_join_requests` where `status = 'pending'`, joined with `dogs` (name, photo_url) and `profiles` (name). Returns `PendingRequest[]` |
| `approveJoinRequest(requestId, packId, userId, dogId)` | `packService.ts` | Update request status to `'approved'`, insert `pack_members` row with `role: 'member'`, trigger push notification |
| `dismissJoinRequest(requestId)` | `packService.ts` | Delete the `pack_join_requests` row |
| `updateMemberRole(packId, memberId, role)` | `packService.ts` | Update `pack_members.role` for given member |
| `getPackMembersWithRoles(packId)` | `packService.ts` | Like `getPackMembers` but also returns `role` field |
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
```

---

## 6. Push Notification

When a request is approved, send a push notification to the requester using the existing `send-push` Supabase edge function:
- Title: pack name
- Body: "Your dog {dogName} was accepted into {packName}! 🎉"
- Uses the requester's `user_id` to look up their push token

---

## 7. Out of Scope

- Demoting Pack Leaders
- Removing members from a pack
- Notification for dismissed requests
- Request approval from within push notification (deep linking)
