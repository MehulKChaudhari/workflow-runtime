export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "workflow-theme";
const TRANSITION_MS = 320;

export function getStoredPreference(): ThemePreference | null {
  const value = localStorage.getItem(STORAGE_KEY);
  if (value === "light" || value === "dark" || value === "system") return value;
  return null;
}

export function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") return getSystemTheme();
  return preference;
}

function setResolvedTheme(resolved: ResolvedTheme): void {
  document.documentElement.setAttribute("data-theme", resolved);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function applyResolvedTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement;

  if (prefersReducedMotion()) {
    setResolvedTheme(resolved);
    return;
  }

  if (typeof document.startViewTransition === "function") {
    document.startViewTransition(() => setResolvedTheme(resolved));
    return;
  }

  root.classList.add("theme-transition");
  setResolvedTheme(resolved);
  window.setTimeout(() => root.classList.remove("theme-transition"), TRANSITION_MS);
}

export function storePreference(preference: ThemePreference): void {
  localStorage.setItem(STORAGE_KEY, preference);
}

export function getInitialPreference(): ThemePreference {
  return getStoredPreference() ?? "system";
}
