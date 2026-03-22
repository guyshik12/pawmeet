# Unread Conversation Count — Zustand Store Refactor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragmented unread conversation count system (5 parallel caches) with a single Zustand store that all screens read from.

**Architecture:** One `useUnreadStore` Zustand store holds the count. FriendsScreen initializes it from database on mount/focus. AppTabs increments it on realtime message inserts. Chat screens decrement it on mount. No more per-screen queries or local state for this count.

**Tech Stack:** Zustand, React Native, Supabase Realtime, @tanstack/react-query (kept for per-chat data, removed for global unread count)

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Create | `src/store/unreadStore.ts` | Zustand store — single source of truth |
| Modify | `src/screens/friends/FriendsScreen.tsx` | Initialize store from query data on mount/focus |
| Modify | `src/navigation/AppTabs.tsx` | Increment store on realtime message INSERT |
| Modify | `src/screens/chat/PackChatScreen.tsx` | Read store, decrement on mount, remove local state + realtime sub for unread |
| Modify | `src/screens/chat/ChatScreen.tsx` | Read store, decrement on mount, remove local state + realtime sub for unread |
| Modify | `src/services/friendService.ts` | Remove `getUnreadConversationCount` function |

---

## Task 1: Create `useUnreadStore`

**Files:**
- Create: `src/store/unreadStore.ts`

- [ ] **Step 1: Create the store**

```typescript
import { create } from 'zustand';

interface UnreadState {
  count: number;
  increment: () => void;
  decrement: () => void;
  setCount: (n: number) => void;
}

export const useUnreadStore = create<UnreadState>((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
  decrement: () => set((s) => ({ count: Math.max(s.count - 1, 0) })),
  setCount: (n: number) => set({ count: n }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/store/unreadStore.ts
git commit -m "feat: create useUnreadStore for global unread conversation count"
```

---

## Task 2: Initialize Store from FriendsScreen

**Files:**
- Modify: `src/screens/friends/FriendsScreen.tsx`

The store needs to be set to the real count whenever FriendsScreen is visible. FriendsScreen already has `unreadCounts` (per-friendship) and `packUnreadCounts` (per-pack) queries. We compute the conversation count from these and push it to the store.

- [ ] **Step 1: Add import**

Add at the top of imports:

```typescript
import { useUnreadStore } from '../../store/unreadStore';
```

- [ ] **Step 2: Add store sync effect**

After the `packUnreadCounts` query (around line 260), add:

```typescript
// Sync unread conversation count to Zustand store
const setUnreadCount = useUnreadStore((s) => s.setCount);
useEffect(() => {
  const friendChatsWithUnread = Object.values(unreadCounts).filter((c) => c > 0).length;
  const packChatsWithUnread = Object.values(packUnreadCounts).filter((c) => c > 0).length;
  setUnreadCount(friendChatsWithUnread + packChatsWithUnread);
}, [unreadCounts, packUnreadCounts]);
```

This runs every time the per-chat unread queries update (every 30s polling, on realtime, on focus). It's the authoritative source — corrects any drift.

- [ ] **Step 3: Commit**

```bash
git add src/screens/friends/FriendsScreen.tsx
git commit -m "feat: sync unread conversation count from queries to Zustand store"
```

---

## Task 3: Increment Store from AppTabs Realtime

**Files:**
- Modify: `src/navigation/AppTabs.tsx`

AppTabs already has a global realtime subscription on `messages` INSERT (line 262). We add `store.increment()` when the message is not from the current user and not in the currently active chat.

- [ ] **Step 1: Add import**

```typescript
import { useUnreadStore } from '../store/unreadStore';
```

- [ ] **Step 2: Update the messages INSERT handler**

In the existing `.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, ...)` handler (around line 262), add after `queryClient.invalidateQueries({ queryKey: ['badge_count'] });`:

```typescript
        // Increment global unread conversation count
        const msg = payload.new;
        if (msg && msg.sender_id !== userRef.current?.id) {
          // Don't increment if user is currently viewing that chat
          if (msg.friendship_id && activeChatFriendshipId === msg.friendship_id) {
            // skip — user is in this chat
          } else {
            useUnreadStore.getState().increment();
          }
        }
```

Note: Use `useUnreadStore.getState().increment()` (not the hook) since this is inside a callback, not a React component render.

**IMPORTANT:** The existing handler already has `const msg = payload.new;` and checks on line 264-266. The increment should happen BEFORE the early return on line 266 (`if (!msg || !currentUser || msg.sender_id === currentUser.id || msg.pack_id) return;`), because that return skips pack messages. We want to increment for ALL messages (friend + pack) that are not from the current user and not in the active chat.

Restructure the handler to:

```typescript
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload: any) => {
        queryClient.invalidateQueries({ queryKey: ['badge_count'] });
        const msg = payload.new;
        const currentUser = userRef.current;
        if (!msg || !currentUser || msg.sender_id === currentUser.id) return;

        // Increment global unread count (for both friend and pack messages)
        if (!(msg.friendship_id && activeChatFriendshipId === msg.friendship_id)) {
          useUnreadStore.getState().increment();
        }

        // Banner logic — only for friend DMs, not pack messages
        if (msg.pack_id) return;
        if (activeChatFriendshipId === msg.friendship_id) return;
        // ... rest of the existing banner lookup code stays unchanged
```

- [ ] **Step 3: Commit**

```bash
git add src/navigation/AppTabs.tsx
git commit -m "feat: increment unread store on realtime message insert"
```

---

## Task 4: Simplify PackChatScreen — Read Store, Decrement on Mount

**Files:**
- Modify: `src/screens/chat/PackChatScreen.tsx`

Remove: `useState` for unreadCount, the "mark as read on mount" `useEffect` that manipulates query caches, and the second realtime listener for "other chats".

Replace with: read from `useUnreadStore`, decrement on mount.

- [ ] **Step 1: Update imports**

Remove the unused `getUnreadConversationCount` import if still present.

Add:
```typescript
import { useUnreadStore } from '../../store/unreadStore';
```

- [ ] **Step 2: Replace unread state with store**

Remove:
```typescript
const [unreadCount, setUnreadCount] = useState(() => {
  const cached = queryClient.getQueryData<number>(['unread_conversation_count', activeDog?.id, user?.id]);
  return cached ?? 0;
});
```

Replace with:
```typescript
const unreadCount = useUnreadStore((s) => s.count);
```

- [ ] **Step 3: Simplify mount handler**

Remove the entire "Mark pack as read on mount" `useEffect` that manipulates `pack_unread_counts` cache and `unread_conversation_count` cache.

Replace with:
```typescript
// Decrement global unread count and mark pack as read
useEffect(() => {
  const cachedUnread = queryClient.getQueryData<Record<string, number>>(['pack_unread_counts', activeDog?.id, user?.id]);
  if ((cachedUnread?.[packId] ?? 0) > 0) {
    useUnreadStore.getState().decrement();
    queryClient.setQueryData(['pack_unread_counts', activeDog?.id, user?.id], (old: Record<string, number> | undefined) => {
      if (!old) return {};
      const next = { ...old };
      delete next[packId];
      return next;
    });
  }
  AsyncStorage.setItem(`pack_last_read_${packId}`, new Date().toISOString());
}, [packId]);
```

- [ ] **Step 4: Remove the second realtime listener**

In the realtime `useEffect`, remove the entire second `.on('postgres_changes', ...)` handler that incremented local state for "other chats". Keep only the first listener (for current pack messages).

The realtime block should become:
```typescript
useEffect(() => {
  const channel = supabase
    .channel(`pack_chat_${packId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages',
      filter: `pack_id=eq.${packId}`,
    }, () => {
      queryClient.invalidateQueries({ queryKey: ['pack_messages', packId] });
      AsyncStorage.setItem(`pack_last_read_${packId}`, new Date().toISOString());
    })
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn('[PackChatScreen] Realtime error:', err);
      }
    });
  return () => { supabase.removeChannel(channel); };
}, [packId]);
```

- [ ] **Step 5: Remove the "mark as read on new messages" useEffect**

Remove the useEffect that does `AsyncStorage.setItem` + `invalidateQueries` on `messages.length` change. The mount handler and realtime handler already mark as read.

Keep only the scroll-to-bottom:
```typescript
useEffect(() => {
  if (messages.length > 0) {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }
}, [messages.length]);
```

- [ ] **Step 6: Commit**

```bash
git add src/screens/chat/PackChatScreen.tsx
git commit -m "refactor: PackChatScreen reads unread from Zustand store"
```

---

## Task 5: Simplify ChatScreen — Read Store, Decrement on Mount

**Files:**
- Modify: `src/screens/chat/ChatScreen.tsx`

Same pattern as Task 4.

- [ ] **Step 1: Update imports**

Remove `getUnreadConversationCount` import if present. Remove `useDogStore` import if only used for unread.

Add:
```typescript
import { useUnreadStore } from '../../store/unreadStore';
```

- [ ] **Step 2: Replace unread state with store**

Remove:
```typescript
const [unreadCount, setUnreadCount] = useState(() => { ... });
```

Replace with:
```typescript
const unreadCount = useUnreadStore((s) => s.count);
```

- [ ] **Step 3: Simplify mount handler**

Remove the "optimistically update unread count on mount" `useEffect`.

Replace with:
```typescript
// Decrement global unread count if this chat had unread
useEffect(() => {
  const cacheKey = ['unread_counts', user?.id, (activeDog ? [activeDog.id] : []).join()];
  const cached = queryClient.getQueryData<Record<string, number>>(cacheKey);
  if ((cached?.[friendshipId] ?? 0) > 0) {
    useUnreadStore.getState().decrement();
    queryClient.setQueryData(cacheKey, (old: Record<string, number> | undefined) => {
      if (!old) return {};
      return { ...old, [friendshipId]: 0 };
    });
  }
}, [friendshipId]);
```

- [ ] **Step 4: Remove the realtime subscription for other chats**

Remove the entire `useEffect` with `channel(`friend_chat_unread_${friendshipId}`)` that listened for messages in other chats.

- [ ] **Step 5: Commit**

```bash
git add src/screens/chat/ChatScreen.tsx
git commit -m "refactor: ChatScreen reads unread from Zustand store"
```

---

## Task 6: Remove `getUnreadConversationCount`

**Files:**
- Modify: `src/services/friendService.ts`

- [ ] **Step 1: Delete the function**

Remove the entire `getUnreadConversationCount` function and its JSDoc comment. Also remove the `AsyncStorage` import if nothing else uses it.

- [ ] **Step 2: Verify no remaining references**

```bash
grep -r "getUnreadConversationCount" src/
```

Should return zero results.

- [ ] **Step 3: Commit**

```bash
git add src/services/friendService.ts
git commit -m "chore: remove unused getUnreadConversationCount"
```

---

## Done ✓

After all tasks:
- ✅ Single Zustand store for unread conversation count
- ✅ FriendsScreen syncs store from query data (authoritative)
- ✅ AppTabs increments on any realtime message (instant)
- ✅ Chat screens decrement on mount (instant)
- ✅ No more per-screen queries or local state for this count
- ✅ No more race conditions between parallel caches
