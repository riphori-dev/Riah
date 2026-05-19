import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { applyColorScheme, Colors, DarkColors, LightColors } from './Colors';

const DARK_MODE_STORAGE_KEY = 'darkModeEnabled';

type ThemeColors = typeof LightColors;

interface ThemeContextValue {
  colors: ThemeColors;
  isDarkMode: boolean;
  setDarkMode: (enabled: boolean) => Promise<void>;
  toggleDarkMode: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const storedValue = await AsyncStorage.getItem(DARK_MODE_STORAGE_KEY);
        const enabled = storedValue === 'true';
        applyColorScheme(enabled);
        setIsDarkMode(enabled);
      } catch (error) {
        console.error('Error loading theme:', error);
      } finally {
        setIsReady(true);
      }
    };

    loadTheme();
  }, []);

  const setDarkMode = async (enabled: boolean) => {
    applyColorScheme(enabled);
    setIsDarkMode(enabled);
    await AsyncStorage.setItem(DARK_MODE_STORAGE_KEY, enabled ? 'true' : 'false');
  };

  const value = useMemo(
    () => ({
      colors: isDarkMode ? DarkColors : LightColors,
      isDarkMode,
      setDarkMode,
      toggleDarkMode: () => setDarkMode(!isDarkMode),
    }),
    [isDarkMode]
  );

  if (!isReady) {
    return null;
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      colors: Colors,
      isDarkMode: false,
      setDarkMode: async () => {},
      toggleDarkMode: async () => {},
    };
  }

  return context;
}
