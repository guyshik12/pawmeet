# Sniffs — App Guide

A walkthrough of every feature in the app, screen by screen.

---

## 1. Onboarding

### Login / Register
Sign up with email and password. After registration, you're prompted to create your first dog profile — name, breed, age, photo, temperament, energy level, and more.

### Multi-Dog Support
You can have multiple dogs on one account. Long-press the Profile tab icon to switch between dogs. Each dog has its own friendships, packs, and chat history.

---

## 2. Discover Tab

The main matchmaking screen. Shows nearby dogs as swipeable cards.

- **Swipe right** (or tap "Say Hi") to like a dog
- **Swipe left** to skip
- When both dogs like each other, a **match popup** appears with both dog photos
- Tap "Chat" on the popup to start messaging immediately

**Distance filter:** Set your maximum discovery range (0–10 km) in Profile settings. Dogs outside your range won't appear.

---

## 3. Friends Tab

Two swipeable pages: **Friends** and **Packs**.

### Friends List
Your matched dogs, sorted by most recent message.

- **Tap the dog photo** → opens their full profile (bio, photos, traits, owner info)
- **Tap anywhere else on the row** → opens the chat
- **Woof button** → sends a quick "Want to meet up?" message
- **Unread badge** shows how many unread messages per friend

### Packs List
Your group chats, sorted by most recent message.

Each pack card shows:
- Pack photo (left)
- Pack name + type badge (Public/Semi-public/Private)
- Last message with sender name
- Time of last message (top right)
- Unread count badge (right)

### Search (magnifying glass icon)
Tap the search icon in the header. Search across:

- **Dogs** — tap to preview. If friends: Chat or Profile buttons. If not: Connect button
- **Owners** — tap to expand and see their dogs, then tap a dog to preview
- **Packs** — Join (public), Request (semi-public), or "Member" status
- **Breeds** — see how many dogs of each breed are nearby

### Creating a Pack
Tap "+" (top left when on Packs). Choose:
- **Pack name**
- **Type:** Public (anyone joins), Semi-public (approval needed), Private (invite only)
- **Add friends** from your friends list (required for private packs)

---

## 4. Pack Chat

Group messaging for pack members.

- **Grouped messages:** consecutive messages from the same dog show the avatar and name only on the first message
- **Your messages:** show your dog's photo and name above the first bubble
- **System messages:** "Dog joined the pack" / "Dog was removed" appear as centered grey text
- **Tap the pack name** → opens Pack Info

### Pack Info Screen
- Pack photo (tap to change if you're a leader)
- Pack name + member count
- **Pending Requests** (leaders only) — Approve or Dismiss
- **Members** — see all members with Pack Leader badges
- **Make Leader** — promote a member (leaders only)
- **Remove Leader** — demote a leader (creator only)
- **Remove** — kick a member (leaders only, can't remove creator)
- **Add Friends** — invite friends directly to the pack

---

## 5. Direct Chat

One-on-one messaging with a friend's owner.

- **Back arrow** shows unread conversation count badge
- **Dog photo** in the header (next to back arrow)
- **Tap the dog name** → opens their profile
- Messages show timestamps
- Real-time delivery via Supabase

---

## 6. Trip Tab (Map)

Go live with your dog's location and see other dogs on trips nearby.

### Before Starting
- Shows current distance range setting
- "Change in Profile settings" link

### During a Trip
- **Live map** with your location updating in real-time
- **Dog markers** — other dogs on trips within your range, with photos
- **Dog park pins** — nearby dog parks shown on the map
- **Status bar** — "2 dogs in range · 5 active"
- **Tap a dog marker** → view their profile, connect if not friends
- **Incoming connection popup** — if another dog likes you during the trip

### Distance Setting
Set once in Profile settings (0–10 km slider). Used by both Discover and Trip screens.

---

## 7. Profile Tab

Your dog's profile and app settings.

- **Dog photo and info** — name, breed, age, bio
- **Edit profile** — update photos, traits, prompts
- **Status** — Active / Looking / Offline (shown to other users)
- **Distance slider** — controls discovery and trip range
- **Owner interests** — hobbies and activities
- **Long-press the tab** to switch between your dogs

---

## 8. Notifications

- **Match notifications** — when both dogs like each other
- **Message notifications** — new DMs (suppressed if you're in that chat)
- **Pack approval** — "Your dog was accepted into [Pack Name]!"
- **In-app banners** — show at the top when a message arrives while you're in the app

---

## 9. Roles & Permissions

### Pack Roles
| Role | Who | Powers |
|---|---|---|
| **Pack Leader** | Creator + promoted members | Approve/dismiss requests, add friends, remove members, promote to leader |
| **Member** | Regular members | Chat, view members |

- Creator is always a Pack Leader and cannot be removed
- Any leader can promote members
- Only the creator can demote other leaders

### Pack Types
| Type | Search | Join |
|---|---|---|
| **Public** | Visible | One-tap join |
| **Semi-public** | Visible | Request → leader approves |
| **Private** | Hidden | Invite only |
