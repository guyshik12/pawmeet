# Groups & Search Redesign — Design Spec
Date: 2026-03-19

## Overview

Redesign the existing placeholder Packs (groups) and Search features into fully functional, production-ready experiences. Three self-contained pieces of work: inline search in Friends, CreatePack screen with type selection, and a real PackChatScreen with grouped messages.

---

## 1. Search in Friends

### Behaviour
- Remove `SearchOverlay` from `DiscoverScreen` entirely.
- Add a search icon (🔍) to the `FriendsScreen` navigation header (right side).
- Tapping the icon expands an inline search bar below the header via an animated view. **While search is active the segmented control is hidden and the "+" pack header button is removed** (via `navigation.setOptions`) — the search results list takes the full remaining height.
- Tapping Cancel or clearing the query collapses back to the normal segmented-control view and restores the "+" button.
- Results render inline below the search bar while active.

### Search Results — four categories
The existing `searchAll` in `searchService.ts` must be extended:
- Add `SearchPackResult` type: `{ type: 'pack'; packId: string; packName: string; memberCount: number; packType: 'public' | 'semi_public' }`
- Add `packs: SearchPackResult[]` to the `SearchResults` type
- Add a query inside `searchAll` that fetches packs where `name.ilike.%query%` AND `type IN ('public', 'semi_public')` — private packs are **never** returned

### Pack results in search
Each pack result row shows:
- Pack type icon (🌍 Public / 🔓 Semi-public)
- Pack name + member count
- **Public**: "Join" button — calls a new `joinPack(packId, userId, dogId)` service function; on success navigate to `PackChat`
- **Semi-public**: "Request" button — calls a new `createJoinRequest(packId, userId)` service function; on success disable the button and show a "Request sent" label in place of the button (no navigation — approval is out of scope for this release)
- **Tapping the row itself** (not the button): for both public and semi-public packs, opens an `Animated.View` bottom sheet (sliding up from the bottom of the screen, same spring config as the existing sheet in `SearchOverlay`: `damping: 18, stiffness: 160`) showing pack name, type icon, member count, and a Join/Request CTA inside the sheet. Tapping the backdrop dismisses it.

---

## 2. Pack Types

Three visibility/join modes, set at creation and stored as a `type` column on the `packs` table:

| Type | Icon | Discoverable in search | Join flow |
|---|---|---|---|
| Public | 🌍 | Yes | One-tap join |
| Semi-public | 🔓 | Yes | Request → creator approves (approval UI out of scope) |
| Private | 🔒 | No | Invite only (creator picks from friends at creation) |

Pack cards in the Packs tab show a small type badge (e.g., `🌍 Public`, `🔒 Private`).

**Implementation order for this section:**
1. First: add `type: 'public' | 'semi_public' | 'private'` to the `Pack` type in `packService.ts` — this is the data source
2. Then: add a `type` prop to `PackCard` and render the badge — only possible once the type is on the data model

---

## 3. CreatePack Screen

Replaces `CreatePackPlaceholder`. A native stack screen accessible from:
1. The empty-state "Start a Pack" button (already wired to `navigation.navigate('CreatePack')`)
2. A "+" button in the Packs sub-view header — implemented via `navigation.setOptions` called inside a `useLayoutEffect` in `FriendsScreen` when `activeTab === 1`

### Layout (top to bottom)
1. **Pack name** — text input, required
2. **Pack type** — three-option selector (Public / Semi-public / Private), defaults to Public
3. **Add Friends** — scrollable list of the current user's existing friends (fetched via `getFriends`), each row tap-toggles a checkmark; shows dog photo + dog name + owner name per row
   - Private packs: at least 1 friend must be selected (required)
   - Public / Semi-public: friend-picker is optional

### Actions
- **Create** button in header, enabled when pack name is non-empty (and ≥1 friend selected for private packs)
- `createPack` signature must be updated to: `createPack(name, creatorUserId, creatorDogId, type, invitedFriendDogIds: string[])` — inserts `type` into `packs` and bulk-inserts `pack_members` rows for each invited friend (using their `dog_id` and `user_id` from the friendship data)
- On success: navigates to `PackChat` for the newly created pack, passing `{ packId, packName, memberCount }`
- **`FriendsStackParamList`** in `AppTabs.tsx` must be updated: `[Routes.PackChat]: { packId: string; packName: string; memberCount: number }` — and the existing `navigate('PackChat', ...)` call in `FriendsScreen` (line ~258) must also be updated to include `memberCount`

---

## 4. PackChatScreen

Replaces `PackChatPlaceholder`. A dedicated screen (not reusing `ChatScreen`) that uses `sendPackMessage` from `packService`.

### Navigation params
`{ packId: string; packName: string; memberCount: number }` — member count passed at navigate time to avoid an extra query on screen mount.

### Message rendering — grouped sender pattern
Messages are grouped by consecutive **dog identity** (not user identity — a user with multiple dogs must group by dog, not by owner). A "streak" is a run of messages from the same `sender_dog_id` with no other dog's message in between.

- **First message in a streak**: show dog avatar (32×32, rounded corners) + dog name above the bubble
- **Subsequent messages in the same streak**: avatar column is blank (same width for alignment), no image or name
- **Own messages**: right-aligned, no avatar or name, primary colour background
- **Others' messages**: left-aligned, dog photo from pack member data, fallback to 🐶 emoji placeholder

### Header
- Pack name as title
- Member count as subtitle passed via navigation params (e.g. "3 members")

### Data
- Fetches messages from `messages` table filtered by `pack_id`, ordered by `created_at` ascending
- Messages must include `sender_dog_id` — see data model section below
- Realtime subscription on `messages` for live updates (same pattern as `ChatScreen`)
- On mount, fetch pack members via a new `getPackMembers(packId: string)` service function in `packService.ts` that queries `pack_members` filtered by `pack_id`, joined with `dogs` for name and photo — builds a `dogId → { name, photo }` lookup map for rendering

### Input
- Same `TextInput` + send button pattern as existing `ChatScreen`
- Calls `sendPackMessage(packId, senderId, senderDogId, content)` — signature updated to include `senderDogId`

---

## 5. Data Model Changes

| Table | Change |
|---|---|
| `packs` | Add `type` column: `'public' \| 'semi_public' \| 'private'`, default `'public'` |
| `pack_join_requests` | New table: `id, pack_id, user_id, dog_id, status ('pending'\|'approved'\|'rejected'), created_at` — `dog_id` stored now so approval flow (future) can create the `pack_members` row without a separate lookup |
| `messages` | Add `sender_dog_id uuid nullable` (nullable to remain compatible with existing 1-on-1 messages which have no dog concept) |

---

## 6. New / Updated Service Functions

| Function | Location | Change |
|---|---|---|
| `searchAll` | `searchService.ts` | Add `packs` field to `SearchResults`; add `SearchPackResult` type; query public+semi-public packs |
| `createPack` | `packService.ts` | Add `type` and `invitedFriendDogIds` params; bulk-insert pack members |
| `sendPackMessage` | `packService.ts` | Add `senderDogId` param; insert `sender_dog_id` into `messages` |
| `joinPack(packId, userId, dogId)` | `packService.ts` | New: insert a `pack_members` row for a public pack |
| `createJoinRequest(packId, userId, dogId)` | `packService.ts` | New: insert a `pack_join_requests` row with status `'pending'` (include `dog_id` for future approval flow) |
| `getPackMembers(packId)` | `packService.ts` | New: query `pack_members` filtered by `pack_id`, joined with `dogs` for name + photo — returns `PackMemberInfo[]` |

---

## 7. Out of Scope

- Join request approval UI (creator reviewing and approving/rejecting requests)
- Removing members from a pack
- Pack settings / rename
- Push notifications for pack messages
