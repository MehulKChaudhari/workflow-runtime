import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  applyResolvedTheme,
  getInitialPreference,
  resolveTheme,
  storePreference,
  type ResolvedTheme,
  type ThemePreference,
} from "../lib/theme";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => getInitialPreference());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(getInitialPreference()),
  );

  useEffect(() => {
    const resolved = resolveTheme(preference);
    setResolvedTheme(resolved);
    applyResolvedTheme(resolved);
    storePreference(preference);
  }, [preference]);

  useEffect(() => {
    if (preference !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const resolved = resolveTheme("system");
      setResolvedTheme(resolved);
      applyResolvedTheme(resolved);
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = (next: ThemePreference) => setPreferenceState(next);

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
