# Sniffs Discovery Hub — Design Spec
Date: 2026-03-22

## Overview

Replace the current DiscoverScreen (swipe cards) with a premium "Discovery Hub" — a visual, filter-first browsing experience with the Midnight Park theme. Swipe cards move into a full-screen "Quick Match" mode accessible via a glowing pill.

---

## 1. Design Aesthetic — Midnight Park Theme

| Token | Value | Usage |
|---|---|---|
| Background | `#121212` | Screen background |
| Surface | `#1E1E1E` | Cards, pills, inputs |
| Border | `#2A2A2A` | Card borders, dividers |
| Primary Accent | `#FFB347` (Electric Amber) | Active pills, Live indicators, highlights |
| Primary Gradient | `#FFB347 → #FF8C00` | Quick Match pill, glowing CTAs |
| Text Primary | `#EEEEEE` | Titles, names |
| Text Secondary | `#888888` | Metadata, labels |
| Text Muted | `#555555` | Timestamps, hints |

Typography: Clean sans-serif (system default). Section headers: 11px uppercase with 1px letter-spacing. Card titles: 13px bold. Body: 11-12px.

---

## 2. Screen Layout (Top to Bottom)

### 2.1 Header
- Left: "✦ Sniffs" in bold amber (#FFB347), 16px
- Right: "Discovery Hub" in secondary text

### 2.2 Search Bar
- Thin-bordered input (`#1E1E1E` background, `#333` border, 12px border-radius)
- 🔍 icon + placeholder "Search dogs, packs, breeds..."
- Takes 100% width
- On tap: opens the existing inline search flow (from FriendsScreen pattern) with categorized results (dogs, owners, packs, breeds)
- On cancel: returns to the Hub feed

### 2.3 Action Pills (Horizontal Row)
These navigate to dedicated screens on tap.

| Pill | Style | Action |
|---|---|---|
| ♥ Quick Match | Amber gradient, glow shadow, bold dark text | Opens full-screen swipe mode (current DiscoverScreen card logic) |
| Open Packs → | Surface background, light text | Opens a list of public/semi-public packs (reuse search pack results UI) |

### 2.4 Filter Pills (Horizontal Scroll, Wrapping)
These toggle in place — the magazine feed below updates instantly. Multiple can be active simultaneously.

| Pill | Filter Logic |
|---|---|
| 🟡 Live Now | Dogs where owner has `on_trip = true` in `locations` table |
| 🐾 Puppy Club | Dogs where `age_years < 1` OR `age_years IS NULL` and `energy_level = 'Puppy'` |
| ⚡ High Energy | Dogs where `energy_level IN ('High Energy', 'Puppy')` |
| 🧬 Same Breed | Dogs where `breed` matches the current user's active dog's breed |

**Active state:** Amber background (`#FFB34722`), amber border, amber text
**Inactive state:** Surface background (`#1E1E1E`), dark border (`#2A2A2A`), secondary text

### 2.5 Magazine Feed Sections

All sections are filtered by active pills when applicable.

#### Section A: Neighborhood Highlights (Packs)
- Horizontal scroll of large pack cards (160px wide, 16px border-radius)
- Each card shows:
  - 3-dog avatar stack (28×28, overlapping by 8px)
  - Pack name (13px bold)
  - Active status: "N active now" in amber if any member is on trip, grey "No one active" otherwise
  - Pack type + member count (10px muted)
- "See all →" link in section header → navigates to Open Packs screen
- Filter interaction: "Live Now" pill filters to packs with active members only

#### Section B: Trending Breeds
- Horizontal scroll of story-style circles (56×56, rounded)
- Most popular breed has amber border, others have dark border
- Below each: breed name (10px) + "N nearby" count
- Tapping a breed circle opens the search with that breed pre-filled
- Filter interaction: pills don't affect this section (it's always showing nearby breed distribution)

#### Section C: New Paws
- Vertical list of dogs who joined in the last 48 hours
- Each row: dog photo (40×40, 12px radius), name (13px bold), breed + distance (11px secondary), time ago (9px muted)
- Cards have surface background with border
- Tapping a dog opens the Quick-View drawer (same bottom sheet as search results)
- Filter interaction: all filter pills apply (Live Now shows only live new dogs, Puppy Club shows only puppies, etc.)

---

## 3. Quick Match (Full-Screen Swipe Mode)

- Tapping the "♥ Quick Match" pill opens a new screen (pushed onto the stack)
- This screen contains the existing DiscoverScreen swipe card logic — same cards, same swipe gestures, same match popup
- Header: back arrow (← returns to Hub) + "Quick Match" title
- The existing `DiscoverScreen` component can be reused/refactored as `QuickMatchScreen`

---

## 4. Quick-View Drawer

When tapping a dog from New Paws or search results, open a bottom sheet (60% screen height) with:
- Hero photo, name, breed, age, distance
- Key trait tags (energy level, temperament)
- Two buttons: "View Full Profile" and "Connect 🐾" (or "Chat" if already friends)
- Swipe down to dismiss — returns to the Hub feed without losing scroll position

This reuses the dog preview bottom sheet already built in the search results.

---

## 5. Data Requirements

### New queries needed
- `getNeighborhoodPacks(dogId, filters?)` — public/semi-public packs near the user, with active member count from `locations.on_trip`
- `getTrendingBreeds(lat, lng, radiusKm)` — breed distribution of dogs within radius
- `getNewPaws(dogId, filters?)` — dogs created in last 48 hours within distance range, with filter support
- `getActiveMemberCount(packId)` — count of pack members currently on trip

### Existing queries reused
- `searchAll` — for the search bar
- Swipe card logic from `DiscoverScreen` — for Quick Match
- Dog preview bottom sheet — from SearchResultsList
- Pack list UI — from search results

### Filter logic
Filters modify the `getNewPaws` and `getNeighborhoodPacks` queries by adding WHERE clauses. Each active pill adds a condition. Multiple pills = AND logic.

---

## 6. Navigation Changes

| Route | Screen | Accessible from |
|---|---|---|
| `Discover` (renamed) | `DiscoveryHubScreen` | Bottom tab (replaces old DiscoverScreen) |
| `QuickMatch` | `QuickMatchScreen` | Quick Match pill in Hub |
| `OpenPacks` | `OpenPacksScreen` | Open Packs pill in Hub |

The `QuickMatch` screen reuses the existing swipe card logic from the current `DiscoverScreen`. The current `DiscoverScreen` is refactored into `DiscoveryHubScreen`.

---

## 7. Micro-interactions

- **Pill tap:** subtle scale animation (0.95 → 1.0) + haptic feedback (light impact)
- **Filter toggle:** pill border and background animate with spring (damping: 20, stiffness: 200)
- **Breed circle tap:** scale down briefly then navigate
- **Quick-View drawer:** spring slide-up (damping: 18, stiffness: 160) — same as existing pack preview
- **Quick Match pill:** subtle pulse glow animation on the amber shadow (repeating, slow)

---

## 8. Out of Scope (V1)

- Personalized recommendations / ML-based feed
- "Suggested for you" section
- Activity feed (who liked who)
- Map view of nearby dogs within the Hub
- Dark/light mode toggle (Hub is always Midnight Park theme)
