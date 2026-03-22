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
