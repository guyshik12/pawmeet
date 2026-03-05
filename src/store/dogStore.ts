import { create } from 'zustand';
import { Dog } from '../types/database.types';

interface DogStore {
  dogs: Dog[];
  currentDogId: string | null;
  setDogs: (dogs: Dog[]) => void;
  setCurrentDogId: (id: string | null) => void;
  currentDog: () => Dog | null;
}

export const useDogStore = create<DogStore>((set, get) => ({
  dogs: [],
  currentDogId: null,
  setDogs: (dogs) => {
    const current = get().currentDogId;
    // If no current dog or current dog no longer exists, default to first
    const stillExists = dogs.find((d) => d.id === current);
    set({
      dogs,
      currentDogId: stillExists ? current : (dogs[0]?.id ?? null),
    });
  },
  setCurrentDogId: (id) => set({ currentDogId: id }),
  currentDog: () => {
    const { dogs, currentDogId } = get();
    return dogs.find((d) => d.id === currentDogId) ?? null;
  },
}));
