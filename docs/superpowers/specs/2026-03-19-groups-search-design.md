# Groups & Search Redesign — Design Spec
Date: 2026-03-19

## Overview

Redesign the existing placeholder Packs (groups) and Search features into fully functional, production-ready experiences. Three self-contained pieces of work: inline search in Friends, CreatePack screen with type selection, and a real PackChatScreen with grouped messages.

---

## 1. Search in Friends

### Behaviour
- Remove `SearchOverlay` from `DiscoverScreen` entirely.
- Add a search icon (🔍) to the `FriendsScreen` navigation header (right side).
- Tapping the icon expands an inline search bar below the header, pushing the Friends/Packs segmented control down.
- Results render inline below the search bar, replacing the friends/packs list while active.
- Tapping Cancel or clearing the query collapses back to the normal view.

### Search Results
Search queries `searchAll` from `searchService` and returns four categories:
- **Dogs** — dog name + breed + owner name
- **Owners** — owner name + their dogs
- **Breeds** — breed name + dog count
- **Packs** — public and semi-public packs only (private packs are never returned)

### Pack results in search
Each pack result shows:
- Pack type icon (🌍 Public / 🔓 Semi-public)
- Pack name + member count
- **Public**: "Join" button — one-tap membership
- **Semi-public**: "Request" button — sends a join request to the creator for approval

---

## 2. Pack Types

Three visibility/join modes, set at creation and stored as a `type` column on the `packs` table:

| Type | Icon | Discoverable in search | Join flow |
|---|---|---|---|
| Public | 🌍 | Yes | One-tap join |
| Semi-public | 🔓 | Yes | Request → creator approves |
| Private | 🔒 | No | Invite only (creator picks from friends) |

Pack cards in the Packs tab show a small type badge (e.g., `🌍 Public`, `🔒 Private`).

---

## 3. CreatePack Screen

Replaces `CreatePackPlaceholder`. A native stack screen accessible from the empty-state "Start a Pack" button and a "+" button in the Packs tab header.

### Layout (top to bottom)
1. **Pack name** — text input, required
2. **Pack type** — three-option selector (Public / Semi-public / Private), defaults to Public
3. **Add Friends** — scrollable list of the current user's existing friends, each row tap-toggles a checkmark; dog photo + dog name + owner name shown per row
   - Private packs: friend-picker is required (at least 1 friend)
   - Public / Semi-public: friend-picker is optional (can create empty and let people join)

### Actions
- **Create** button in header, enabled when pack name is non-empty
- On success: navigates to `PackChat` for the newly created pack
- Creator is automatically added as the first member

---

## 4. PackChatScreen

Replaces `PackChatPlaceholder`. A dedicated screen (not reusing `ChatScreen`) that shares message-sending logic via `sendPackMessage` from `packService`.

### Message rendering — grouped sender pattern
Messages are grouped by consecutive sender. A "streak" is a run of messages from the same dog with no other dog's message in between.

- **First message in a streak**: show dog avatar (circular, 32×32) + dog name above the bubble
- **Subsequent messages in the same streak**: avatar space is preserved (blank, same width) but no image or name is shown — keeps alignment consistent
- **Own messages**: right-aligned, no avatar or name, primary colour background
- **Others' messages**: left-aligned, dog photo from `PackMemberInfo.dogPhoto`, fallback to 🐶 emoji placeholder

### Header
- Pack name as title
- Member count as subtitle (e.g. "3 members")

### Data
- Fetches messages from `messages` table filtered by `pack_id`, ordered by `created_at` ascending
- Realtime subscription on `messages` for live updates
- Each message row needs `sender_dog_id` (or lookup via `sender_id` → `pack_members`) to resolve dog photo + name

### Input
- Same `TextInput` + send button pattern as existing `ChatScreen`
- Calls `sendPackMessage(packId, senderId, content)` from `packService`

---

## 5. Data Model Changes

| Table | Change |
|---|---|
| `packs` | Add `type` column: `'public' \| 'semi_public' \| 'private'`, default `'public'` |
| `pack_join_requests` | New table: `id, pack_id, user_id, status ('pending'\|'approved'\|'rejected'), created_at` |
| `messages` | Already has `pack_id` — no change needed |

---

## 6. Out of Scope

- Join request approval UI (creator reviewing requests) — follow-up feature
- Removing members from a pack
- Pack settings / rename
- Push notifications for pack messages
