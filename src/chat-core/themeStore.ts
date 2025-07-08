import { createStore } from "zustand/vanilla";

interface ThemeStore {
  theme: Record<string, string>;
  setTheme: (theme: Record<string, string>) => void;
  getTheme: () => Record<string, string>;
  subscribe: (cb: () => void) => () => void;
}

const store = createStore<ThemeStore>((set) => ({
  theme: {},
  setTheme: (theme) => set({ theme }),
  getTheme: (): Record<string, string> => store.getState().theme,
  subscribe: (cb) => {
    const unsubscribe = store.subscribe(() => cb());
    return () => unsubscribe();
  },
}));

export default store;
