"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useTransition,
  useCallback,
  ReactNode,
} from "react";

export type Theme = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  mounted: boolean;
  toggle: () => void;
  setTheme: (mode: Theme) => void;
  setThemeMode: (mode: Theme) => void;
}

const STORAGE_KEY = "ts-theme";

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  resolvedTheme: "dark",
  mounted: false,
  toggle: () => {},
  setTheme: () => {},
  setThemeMode: () => {},
});

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");
  const [mounted, setMounted] = useState(false);
  const [, startTransition] = useTransition();

  // Apply theme to DOM documentElement
  const applyThemeToDom = useCallback((resolved: ResolvedTheme) => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.style.colorScheme = resolved;
  }, []);

  // Initialize theme from storage or system on mount
  useEffect(() => {
    let initialTheme: Theme = "system";
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (saved === "light" || saved === "dark" || saved === "system") {
        initialTheme = saved;
      } else {
        const domAttr = document.documentElement.getAttribute(
          "data-theme"
        ) as ResolvedTheme | null;
        if (domAttr === "light" || domAttr === "dark") {
          initialTheme = domAttr;
        }
      }
    } catch {
      // ignore
    }

    const resolved: ResolvedTheme =
      initialTheme === "system" ? getSystemTheme() : initialTheme;

    startTransition(() => {
      setThemeState(initialTheme);
      setResolvedTheme(resolved);
      setMounted(true);
    });

    applyThemeToDom(resolved);
  }, [applyThemeToDom]);

  // Listen to OS system theme changes when user is in "system" mode
  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");

    const handleChange = (e: MediaQueryListEvent) => {
      if (theme === "system") {
        const nextResolved: ResolvedTheme = e.matches ? "light" : "dark";
        setResolvedTheme(nextResolved);
        applyThemeToDom(nextResolved);
      }
    };

    try {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    } catch {
      // Fallback for older Safari
      media.addListener(handleChange);
      return () => media.removeListener(handleChange);
    }
  }, [theme, applyThemeToDom]);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      const nextResolved: ResolvedTheme =
        newTheme === "system" ? getSystemTheme() : newTheme;
      setResolvedTheme(nextResolved);

      try {
        localStorage.setItem(STORAGE_KEY, newTheme);
      } catch {
        // ignore
      }
      applyThemeToDom(nextResolved);
    },
    [applyThemeToDom]
  );

  const toggle = useCallback(() => {
    const next: Theme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
  }, [resolvedTheme, setTheme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        mounted,
        toggle,
        setTheme,
        setThemeMode: setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
