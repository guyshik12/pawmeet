# Sniffs

A location-based social app for dog owners. Meet nearby dogs, chat with their owners, form packs for group walks, and track trips on a live map.

## Tech Stack

- **React Native** (Expo SDK 54)
- **Supabase** — Postgres, Auth, Realtime, Storage, Edge Functions
- **Zustand** — global state (auth, active dog, unread counts)
- **React Query** — data fetching and caching
- **React Navigation** — bottom tabs + native stack
- **react-native-maps** — trip map with live GPS
- **expo-location** — location tracking during trips
- **expo-notifications** — push notifications for matches and messages

## Getting Started

```bash
# Install dependencies
npm install

# Start the Expo dev server
npx expo start
```

Open in Expo Go on your phone, or press `i` for iOS Simulator.

### Environment

Create a `.env` file in the project root:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Project Structure

```
src/
  components/       UI components (PackCard, SegmentedControl, etc.)
  constants/        Theme colors, spacing, routes
  hooks/            Custom hooks (useToast)
  lib/              Supabase client
  navigation/       Tab navigator + stack navigators
  screens/
    auth/           Login, Register
    chat/           ChatScreen (1-on-1), PackChatScreen (group)
    discover/       DiscoverScreen (swipe to match)
    dogs/           Dog profiles, add/edit modals
    friends/        Friends list, Packs, CreatePack, PackRequests
    profile/        User profile + settings
    walks/          Trip mode with live map
  services/         API layer (Supabase queries)
  store/            Zustand stores (auth, dogs, unread)
  types/            Database types
  utils/            Distance calculations
supabase/
  functions/        Edge functions (push notifications)
```

## Features

### Discover & Match
Swipe through nearby dogs. When both dogs like each other, it's a match — a friendship is created and both owners get a popup notification.

### Friends & Chat
View your friends list sorted by latest message. Tap a dog's photo to see their profile, tap anywhere else to open the chat. Real-time messaging with delivery indicators.

### Packs (Groups)
Create packs with friends for group walks. Three types:
- **Public** — anyone can join
- **Semi-public** — visible in search, requires leader approval
- **Private** — invite only

Pack chat features grouped sender messages (avatar + name only on first message per streak). Pack Leaders can approve join requests, promote members, and manage the group.

### Search
Inline search in the Friends tab. Search for dogs, owners, breeds, and packs. Tap a dog to preview their profile and connect. Tap an owner to expand and see their dogs. Pack results show Join/Request/Member status.

### Trip Mode
Go live with your dog's GPS location. See other dogs on trips nearby on a real-time map. Tap a dog marker to view their profile and connect. Distance filter controlled from Profile settings.

### Unread Counts
Global unread conversation count via Zustand store. Updates instantly — entering a chat decrements, new messages from other chats increment. No polling delay.

## Supabase Setup

The app requires these tables: `profiles`, `dogs`, `locations`, `friendships`, `friend_requests`, `messages`, `packs`, `pack_members`, `pack_join_requests`. Plus a `pack-photos` storage bucket.

See `src/types/database.types.ts` for the full schema.

## Edge Functions

- `send-push` — sends push notifications for new DMs and pack join approvals via Expo Push API
