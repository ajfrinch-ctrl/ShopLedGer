import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * ইউআই পছন্দ — দোকানের হিসাবের স্টোর (`store.ts`) থেকে আলাদা রাখা,
 * যাতে ডেমো রিসেট/ব্যাকআপে এগুলো জড়িয়ে না পড়ে।
 */
interface UiPrefs {
  /** টপবারের রঙ দিনের আবহাওয়া/সময় অনুযায়ী নিজে থেকে বদলাবে কি না। */
  skyTheme: boolean;
  setSkyTheme: (on: boolean) => void;
}

export const useUiPrefs = create<UiPrefs>()(
  persist(
    (set) => ({
      skyTheme: true,
      setSkyTheme: (on) => set({ skyTheme: on }),
    }),
    { name: "shopledger-ui-prefs" },
  ),
);
