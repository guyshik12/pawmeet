# Search Results Actions — Design Spec
Date: 2026-03-22

## Overview

Make dog and owner search results interactive. Tapping a dog opens a bottom sheet preview with connect/chat/profile actions. Tapping an owner expands to show their dogs as tappable rows.

---

## 1. Dog Result — Bottom Sheet Preview

Tapping a dog in search results opens an `Animated.View` bottom sheet (same spring config as pack preview: `damping: 18, stiffness: 160`) showing:

### Layout
- Dog photo (80×80, rounded)
- Dog name + breed + age (if available)
- Owner name below
- Action buttons based on friendship status

### Actions — Already Friends (`isFriend: true`)
- **Chat** button (primary fill) → navigates to `ChatScreen` with the friendship params
- **Profile** button (outline) → navigates to `FriendProfileScreen`
- Need to fetch friendship data (`friendshipId`, `isUserA`) from the `friendships` table using the dog IDs

### Actions — Not Friends (`isFriend: false`)
- **Connect 🐾** button (primary fill) → calls `handleDogLike(myDogId, searchDogId, myUserId, searchDogOwnerId)`
- If mutual match → show match popup (via the existing AppTabs match detection)
- If one-sided → button changes to "Request Sent ✓" (disabled)
- Tapping the backdrop dismisses the sheet

---

## 2. Owner Result — Expandable Dog List

Tapping an owner row toggles an expanded view below it showing their dogs as sub-rows.

### Layout
- Owner row stays as-is (photo, name, dog names)
- On tap, the row expands to show each dog as a separate tappable row below
- Each dog sub-row: dog photo (small), dog name, breed
- Tapping a dog sub-row opens the same bottom sheet preview as Section 1
- Tapping the owner row again collapses the list

### Data
- The `SearchOwnerResult` already has `dogs: { name: string; breed: string | null }[]` but no `dogId` or `dogPhoto`
- Need to extend `SearchOwnerResult` to include `dogs: { id: string; name: string; breed: string | null; photo: string | null }[]`
- Update the `searchAll` query to include dog `id` and `photo_url` in the owner's dogs sub-select

---

## 3. Data Requirements

### New service function
- `getFriendshipByDogs(myDogId: string, theirDogId: string)` in `friendService.ts` — queries `friendships` where `(dog_a = myDogId AND dog_b = theirDogId) OR (dog_a = theirDogId AND dog_b = myDogId)`. Returns `{ friendshipId, isUserA } | null`. Used by the dog preview sheet to determine which actions to show and to navigate to chat/profile.

### Updated types
- `SearchOwnerResult.dogs` extended to `{ id: string; name: string; breed: string | null; photo: string | null }[]`
- `SearchDogResult` already has all needed fields (`dogId`, `dogPhoto`, `ownerId`, `ownerName`, `isFriend`)

### searchAll update
- Owner sub-query for dogs: change from `dogs: { name: string; breed: string | null }[]` to include `id` and `photo_url`

---

## 4. Implementation Scope

### In scope
- Dog bottom sheet preview with Connect/Chat/Profile
- Owner row expansion with tappable dogs
- `getFriendshipByDogs` service function
- `searchAll` owner dogs data extension

### Out of scope
- Dog profile screen for non-friends (reusing FriendProfileScreen requires friendship)
- Breed results interactivity
- Push notification on connect
