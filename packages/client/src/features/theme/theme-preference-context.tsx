import type { ThemeProviderProps } from '@gamezilla/shared/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = '@gamezilla/color-scheme-preference';

export type ThemePreference = ThemeProviderProps['colorScheme'];

type ThemePreferenceContextValue = {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const ThemePreferenceContext =
  createContext<ThemePreferenceContextValue | null>(null);

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw === 'light' || raw === 'dark' || raw === 'system') {
        setPreferenceState(raw);
      }
    });
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    void AsyncStorage.setItem(STORAGE_KEY, p);
  }, []);

  const value = useMemo(
    (): ThemePreferenceContextValue => ({ preference, setPreference }),
    [preference, setPreference],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreferenceContextValue {
  const ctx = useContext(ThemePreferenceContext);
  if (ctx === null) {
    throw new Error(
      'useThemePreference must be used within ThemePreferenceProvider',
    );
  }
  return ctx;
}
