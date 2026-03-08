import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Intern, Worksite } from '@/types/intern';
import { DEFAULT_WORKSITES } from '@/types/intern';

interface AppState {
  interns: Intern[];
  worksites: Worksite[];
  setInterns: (interns: Intern[]) => void;
  mergeInterns: (newInterns: Intern[]) => void;
  addWorksite: (ws: Worksite) => void;
  updateWorksite: (id: string, updates: Partial<Worksite>) => void;
  removeWorksite: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      interns: [],
      worksites: DEFAULT_WORKSITES,
      setInterns: (interns) => set({ interns }),
      mergeInterns: (newInterns) => {
        const existing = get().interns;
        // Build map by name key, keeping newest
        const map = new Map<string, Intern>();
        
        for (const intern of [...existing, ...newInterns]) {
          const key = `${intern.firstName.toLowerCase()}_${intern.lastName.toLowerCase()}`;
          const current = map.get(key);
          if (!current) {
            map.set(key, intern);
          } else {
            const newTime = new Date(intern.timestamp).getTime() || 0;
            const curTime = new Date(current.timestamp).getTime() || 0;
            if (newTime > curTime) {
              map.set(key, { ...intern, isDuplicate: true, isNewest: true });
            }
          }
        }
        
        // Mark all duplicates
        const allInterns = [...existing, ...newInterns];
        const nameCounts = new Map<string, number>();
        for (const intern of allInterns) {
          const key = `${intern.firstName.toLowerCase()}_${intern.lastName.toLowerCase()}`;
          nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
        }
        
        const result = Array.from(map.values()).map(intern => {
          const key = `${intern.firstName.toLowerCase()}_${intern.lastName.toLowerCase()}`;
          return {
            ...intern,
            isDuplicate: (nameCounts.get(key) || 0) > 1,
            isNewest: true,
          };
        });
        
        set({ interns: result });
      },
      addWorksite: (ws) => set((s) => ({ worksites: [...s.worksites, ws] })),
      updateWorksite: (id, updates) =>
        set((s) => ({
          worksites: s.worksites.map((w) => (w.id === id ? { ...w, ...updates } : w)),
        })),
      removeWorksite: (id) =>
        set((s) => ({ worksites: s.worksites.filter((w) => w.id !== id) })),
    }),
    { name: 'intern-placement-store' }
  )
);
