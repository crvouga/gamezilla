/**
 * Light / dark / system preference with optional persistence.
 * Pass a storage adapter (e.g. AsyncStorage) from the app; shared stays dependency-free.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { ThemeProviderProps } from './theme-context';

const DEFAULT_STORAGE_KEY = '@gamezilla/color-scheme-preference';

export type ThemePreference = ThemeProviderProps['colorScheme'];

export type ThemePreferenceStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

type ThemePreferenceContextValue = {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const ThemePreferenceContext =
  createContext<ThemePreferenceContextValue | null>(null);

export type ThemePreferenceProviderProps = {
  children: ReactNode;
  /** When set, preference is loaded/saved here. Omit for in-memory only (`system` default). */
  storage?: ThemePreferenceStorage;
  /** AsyncStorage key (or equivalent) when `storage` is set. */
  storageKey?: string;
};

export function ThemePreferenceProvider({
  children,
  storage,
  storageKey = DEFAULT_STORAGE_KEY,
}: ThemePreferenceProviderProps) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    if (storage === undefined) {
      return;
    }
    void storage.getItem(storageKey).then((raw) => {
      if (raw === 'light' || raw === 'dark' || raw === 'system') {
        setPreferenceState(raw);
      }
    });
  }, [storage, storageKey]);

  const setPreference = useCallback(
    (p: ThemePreference) => {
      setPreferenceState(p);
      if (storage !== undefined) {
        void storage.setItem(storageKey, p);
      }
    },
    [storage, storageKey]
  );

  const value = useMemo(
    (): ThemePreferenceContextValue => ({ preference, setPreference }),
    [preference, setPreference]
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
      'useThemePreference must be used within ThemePreferenceProvider'
    );
  }
  return ctx;
}
