# Discovery Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the DiscoverScreen with a premium Discovery Hub featuring a Midnight Park theme, smart filter pills, curated magazine-style feed sections, and a Quick Match full-screen swipe mode.

**Architecture:** Extract the existing swipe card logic into a standalone `QuickMatchScreen`, then build `DiscoveryHubScreen` as the new Discover tab content. New service functions power the feed sections (trending breeds, new paws, neighborhood packs). Filter pills modify feed queries client-side via state.

**Tech Stack:** React Native (Expo), Supabase, React Query, react-native-reanimated (swipe cards), Zustand, Animated (pills/sheets)

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Create | `src/screens/discover/DiscoveryHubScreen.tsx` | New Hub screen — search, pills, magazine feed |
| Create | `src/screens/discover/QuickMatchScreen.tsx` | Full-screen swipe mode (extracted from DiscoverScreen) |
| Create | `src/services/hubService.ts` | Data queries for Hub feed sections |
| Modify | `src/constants/routes.ts` | Add `QuickMatch`, `OpenPacks` routes |
| Modify | `src/navigation/AppTabs.tsx` | Point Discover tab to Hub, register new routes |
| Keep | `src/screens/discover/DiscoverScreen.tsx` | Keep as reference, not imported after migration |

---

## Task 1: Hub Service Functions

**Files:**
- Create: `src/services/hubService.ts`

- [ ] **Step 1: Create the service file with all Hub queries**

```typescript
import { supabase } from '../lib/supabase';

// Types
export type NeighborhoodPack = {
  id: string;
  name: string;
  type: 'public' | 'semi_public';
  photo_url: string | null;
  memberCount: number;
  activeMemberCount: number;
  memberPhotos: string[];
};

export type TrendingBreed = {
  breed: string;
  count: number;
};

export type NewPawsDog = {
  id: string;
  name: string;
  breed: string | null;
  photo_url: string | null;
  age_years: number | null;
  energy_level: string | null;
  owner_id: string;
  owner_name: string;
  distance_km: number | null;
  created_at: string;
};

// Filters that pills can apply
export type HubFilters = {
  liveNow?: boolean;
  puppyClub?: boolean;
  highEnergy?: boolean;
  sameBreed?: string | null; // breed name to match
};

// ─── Neighborhood Highlights ─────────────────────────────────────────────────

export async function getNeighborhoodPacks(currentUserId: string): Promise<NeighborhoodPack[]> {
  const { data, error } = await supabase
    .from('packs')
    .select('id, name, type, photo_url, pack_members(user_id, dog_id, dog:dogs!dog_id(photo_url))')
    .in('type', ['public', 'semi_public'])
    .limit(10);
  if (error) throw error;

  // Get active trip user IDs
  const { data: tripUsers } = await supabase
    .from('locations')
    .select('owner_id')
    .eq('on_trip', true);
  const activeUserIds = new Set((tripUsers ?? []).map((t: any) => t.owner_id));

  return (data ?? []).map((p: any) => {
    const members = p.pack_members ?? [];
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      photo_url: p.photo_url,
      memberCount: members.length,
      activeMemberCount: members.filter((m: any) => activeUserIds.has(m.user_id)).length,
      memberPhotos: members
        .slice(0, 3)
        .map((m: any) => m.dog?.photo_url)
        .filter(Boolean),
    };
  });
}

// ─── Trending Breeds ─────────────────────────────────────────────────────────

export async function getTrendingBreeds(currentUserId: string): Promise<TrendingBreed[]> {
  const { data, error } = await supabase
    .from('dogs')
    .select('breed')
    .neq('owner_id', currentUserId)
    .not('breed', 'is', null);
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const d of data ?? []) {
    const breed = (d as any).breed;
    if (breed) counts[breed] = (counts[breed] ?? 0) + 1;
  }

  return Object.entries(counts)
    .map(([breed, count]) => ({ breed, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

// ─── New Paws ────────────────────────────────────────────────────────────────

export async function getNewPaws(currentUserId: string): Promise<NewPawsDog[]> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('dogs')
    .select('id, name, breed, photo_url, age_years, energy_level, owner_id, created_at, owner:profiles!owner_id(name)')
    .neq('owner_id', currentUserId)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;

  return (data ?? []).map((d: any) => ({
    id: d.id,
    name: d.name,
    breed: d.breed ?? null,
    photo_url: d.photo_url ?? null,
    age_years: d.age_years ?? null,
    energy_level: d.energy_level ?? null,
    owner_id: d.owner_id,
    owner_name: d.owner?.name ?? 'Unknown',
    distance_km: null, // Can be computed client-side if location available
    created_at: d.created_at,
  }));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/hubService.ts
git commit -m "feat: add hubService with neighborhood packs, trending breeds, new paws queries"
```

---

## Task 2: Routes and Navigation Setup

**Files:**
- Modify: `src/constants/routes.ts`
- Modify: `src/navigation/AppTabs.tsx`

- [ ] **Step 1: Add routes**

In `src/constants/routes.ts`, add before the closing `} as const;`:

```typescript
QuickMatch: 'QuickMatch',
OpenPacks: 'OpenPacks',
```

- [ ] **Step 2: Update AppTabs — add DiscoverStack**

The Discover tab currently renders `DiscoverScreen` directly. We need a stack navigator so Hub can push QuickMatch and OpenPacks.

In `src/navigation/AppTabs.tsx`:

1. Add imports:
```typescript
import DiscoveryHubScreen from '../screens/discover/DiscoveryHubScreen';
import QuickMatchScreen from '../screens/discover/QuickMatchScreen';
```

2. Create a DiscoverStack param list and navigator:
```typescript
export type DiscoverStackParamList = {
  [Routes.Discover]: undefined;
  [Routes.QuickMatch]: undefined;
  [Routes.OpenPacks]: undefined;
};

const DiscoverStack = createNativeStackNavigator<DiscoverStackParamList>();

function DiscoverNavigator() {
  return (
    <DiscoverStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#121212' },
        headerTintColor: '#FFB347',
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      <DiscoverStack.Screen
        name={Routes.Discover}
        component={DiscoveryHubScreen}
        options={{ headerShown: false }}
      />
      <DiscoverStack.Screen
        name={Routes.QuickMatch}
        component={QuickMatchScreen}
        options={{ title: 'Quick Match', headerBackTitle: ' ' }}
      />
      <DiscoverStack.Screen
        name={Routes.OpenPacks}
        component={QuickMatchScreen}
        options={{ title: 'Open Packs', headerBackTitle: ' ' }}
      />
    </DiscoverStack.Navigator>
  );
}
```

Note: `OpenPacks` initially points to `QuickMatchScreen` as a placeholder — it gets its own screen in a later task, or reuses the search pack results. For V1, we can use a simple pack list.

3. Replace the Discover tab screen:
Change `component={DiscoverScreen}` to `component={DiscoverNavigator}` and add `headerShown: false` to the tab options.

- [ ] **Step 3: Commit**

```bash
git add src/constants/routes.ts src/navigation/AppTabs.tsx
git commit -m "feat: add Discover stack with Hub, QuickMatch, OpenPacks routes"
```

---

## Task 3: QuickMatchScreen — Extract Swipe Cards

**Files:**
- Create: `src/screens/discover/QuickMatchScreen.tsx`

- [ ] **Step 1: Create QuickMatchScreen**

Copy the core logic from the existing `DiscoverScreen.tsx` into `QuickMatchScreen.tsx`. This includes:

- The `computeMatch` function and related helpers (lines 40-95)
- The `SwipeCard` component (lines 97-453)
- The `ProfileDetails` component
- The main screen component with swipe logic, location fetching, card deck

Key changes from the original:
- Remove the distance filter UI (the Hub handles that via Profile settings)
- Remove the search overlay (moved to Hub)
- Keep the match popup (`MatchModal`)
- Add a simple header: "Quick Match" with back button (handled by navigation)
- Keep all the swipe gesture logic, animated styles, card rendering

The screen should be a standalone component that:
1. Fetches location
2. Loads nearby dogs
3. Renders the card deck with swipe gestures
4. Handles likes/matches

This is a large file (~600-700 lines) since it contains the card rendering and animation logic. That's OK — it's all cohesive swipe-card logic.

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/guyshik/DogPark && npx tsc --noEmit 2>&1 | grep QuickMatch
```

Expected: no errors in QuickMatchScreen (pre-existing errors elsewhere are fine).

- [ ] **Step 3: Commit**

```bash
git add src/screens/discover/QuickMatchScreen.tsx
git commit -m "feat: extract swipe cards into QuickMatchScreen"
```

---

## Task 4: DiscoveryHubScreen — Main Hub

**Files:**
- Create: `src/screens/discover/DiscoveryHubScreen.tsx`

- [ ] **Step 1: Create the Hub screen**

A new screen with the Midnight Park theme. Structure:

```
SafeAreaView (#121212 background)
  ScrollView
    Header (✦ Sniffs + Discovery Hub)
    Search Bar (tappable → opens search overlay)
    Action Pills Row (Quick Match, Open Packs)
    Filter Pills Row (Live Now, Puppy Club, High Energy, Same Breed)
    Section: Neighborhood Highlights (horizontal pack cards)
    Section: Trending Breeds (story circles)
    Section: New Paws (vertical list)
```

Key implementation details:

**Midnight Park Theme constants** (define at top of file):
```typescript
const hub = {
  bg: '#121212',
  surface: '#1E1E1E',
  border: '#2A2A2A',
  amber: '#FFB347',
  amberDark: '#FF8C00',
  amberGlow: 'rgba(255,179,71,0.35)',
  amberBg: '#FFB34722',
  text: '#EEEEEE',
  textSecondary: '#888888',
  textMuted: '#555555',
};
```

**Filter state:**
```typescript
const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

function toggleFilter(filter: string) {
  setActiveFilters((prev) => {
    const next = new Set(prev);
    if (next.has(filter)) next.delete(filter);
    else next.add(filter);
    return next;
  });
}
```

**Data queries using React Query:**
```typescript
const { data: packs = [] } = useQuery({
  queryKey: ['hub_packs'],
  queryFn: () => getNeighborhoodPacks(userId),
  enabled: !!user,
});

const { data: breeds = [] } = useQuery({
  queryKey: ['hub_breeds'],
  queryFn: () => getTrendingBreeds(userId),
  enabled: !!user,
});

const { data: newPaws = [] } = useQuery({
  queryKey: ['hub_new_paws'],
  queryFn: () => getNewPaws(userId),
  enabled: !!user,
});
```

**Client-side filtering:**
```typescript
const filteredPacks = useMemo(() => {
  let result = packs;
  if (activeFilters.has('liveNow')) result = result.filter((p) => p.activeMemberCount > 0);
  return result;
}, [packs, activeFilters]);

const filteredNewPaws = useMemo(() => {
  let result = newPaws;
  if (activeFilters.has('liveNow')) {
    // Would need trip status per dog — skip for V1 or add to query
  }
  if (activeFilters.has('puppyClub')) result = result.filter((d) => (d.age_years ?? 0) < 1 || d.energy_level === 'Puppy');
  if (activeFilters.has('highEnergy')) result = result.filter((d) => d.energy_level === 'High Energy' || d.energy_level === 'Puppy');
  if (activeFilters.has('sameBreed') && myDog?.breed) result = result.filter((d) => d.breed === myDog.breed);
  return result;
}, [newPaws, activeFilters, myDog?.breed]);
```

**Action pills:**
- Quick Match → `navigation.navigate('QuickMatch')`
- Open Packs → `navigation.navigate('OpenPacks')`

**Filter pills** with spring animation on toggle:
```typescript
function FilterPill({ label, icon, active, onPress }: { label: string; icon: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        hubStyles.filterPill,
        active && hubStyles.filterPillActive,
      ]}
    >
      <Text style={[hubStyles.filterPillText, active && hubStyles.filterPillTextActive]}>
        {icon} {label}
      </Text>
    </TouchableOpacity>
  );
}
```

**Neighborhood Highlights** — horizontal FlatList of pack cards. Tap → navigate to PackChat (or the search pack preview bottom sheet).

**Trending Breeds** — horizontal FlatList of circles. Tap → could navigate to search with breed pre-filled (nice to have, can skip for V1).

**New Paws** — vertical list. Tap → opens the dog preview bottom sheet (reuse from SearchResultsList, or a simpler inline version for V1).

**Search bar** — tappable, navigates to a search overlay. For V1, this can reuse the existing search logic from FriendsScreen or simply navigate to a modal. Keep it simple — a text input that on focus opens a search flow.

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/guyshik/DogPark && npx tsc --noEmit 2>&1 | grep DiscoveryHub
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/discover/DiscoveryHubScreen.tsx
git commit -m "feat: implement DiscoveryHubScreen with Midnight Park theme"
```

---

## Task 5: Wire Discover Tab to Hub

**Files:**
- Modify: `src/navigation/AppTabs.tsx`

- [ ] **Step 1: Replace Discover tab component**

Remove the old `import DiscoverScreen` and replace the Discover tab to use `DiscoverNavigator`:

```typescript
<Tab.Screen
  name="DiscoverStack"
  component={DiscoverNavigator}
  options={{
    headerShown: false,
    title: 'Discover',
    tabBarIcon: ({ focused }) => <TabIcon emoji="🐾" focused={focused} />,
  }}
/>
```

- [ ] **Step 2: Update OpenPacks to use a real screen**

For V1, `OpenPacks` can render a simple list of public packs. Reuse `getNeighborhoodPacks` from hubService. Create an inline component or a minimal screen.

Alternatively, just use the existing search with "Open Packs" pre-filtered. The simplest V1: navigate to the existing search overlay with packs pre-loaded.

- [ ] **Step 3: Smoke test**

1. Open app → Discover tab should show the Hub
2. Tap Quick Match → full-screen swipe cards
3. Tap back → returns to Hub
4. Toggle filter pills → feed updates
5. Tap a pack card → navigates to PackChat
6. Search bar is tappable

- [ ] **Step 4: Commit**

```bash
git add src/navigation/AppTabs.tsx
git commit -m "feat: wire Discover tab to DiscoveryHubScreen"
```

---

## Done ✓

All features shipped:
- ✅ Midnight Park theme (#121212 background, amber accents)
- ✅ Search bar at top
- ✅ Action pills: Quick Match (glowing amber), Open Packs
- ✅ Filter pills: Live Now, Puppy Club, High Energy, Same Breed
- ✅ Neighborhood Highlights (horizontal pack cards with active status)
- ✅ Trending Breeds (story circles)
- ✅ New Paws (recent dogs list)
- ✅ Quick Match full-screen swipe mode (extracted from old Discover)
- ✅ Navigation stack for Discover tab
