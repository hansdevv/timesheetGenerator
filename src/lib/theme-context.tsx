"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  setThemeMode: (mode: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggle: () => {},
  setThemeMode: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const currentAttr = document.documentElement.getAttribute("data-theme") as Theme | null;
    if (currentAttr === "light" || currentAttr === "dark") {
      return;
    }
    const saved = localStorage.getItem("ts-theme") as Theme | null;
    if (saved === "light" || saved === "dark") {
      document.documentElement.setAttribute("data-theme", saved);
      return;
    }
    if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, []);

  // Ensure DOM attribute matches active state
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Listen to OS system theme changes if user hasn't saved an explicit preference
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const handler = (e: MediaQueryListEvent) => {
      const saved = localStorage.getItem("ts-theme");
      if (!saved) {
        setTheme(e.matches ? "light" : "dark");
      }
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  const setThemeMode = (newTheme: Theme) => {
    setTheme(newTheme);
    try {
      localStorage.setItem("ts-theme", newTheme);
      document.documentElement.setAttribute("data-theme", newTheme);
    } catch {
      // ignore in restricted iframe/incognito
    }
  };

  const toggle = () => {
    setThemeMode(theme === "dark" ? "light" : "dark");
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
