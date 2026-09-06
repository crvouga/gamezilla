/**
 * Light / dark / system preference persisted via {@link useKvState}
 * (i.e. through any ambient `<KvProvider>`). When no provider is mounted
 * the hook silently falls back to in-memory state.
 */

import { asKeyword } from '@pkgs/keyword/keyword';
import { enumKvCodec } from '@pkgs/kv/kv-state-codec';
import { useKvState } from '@pkgs/kv/use-kv-state';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from 'react';

import type { ThemeProviderProps } from './theme-context';

const COLOR_SCHEME_ROW_KEY = asKeyword('ui.prefs/color-scheme');
const COLOR_SCHEME_VALUE_ATTR = asKeyword('ui.prefs/value');
const COLOR_SCHEME_VALUES = ['light', 'dark', 'system'] as const;
const COLOR_SCHEME_CODEC = enumKvCodec<(typeof COLOR_SCHEME_VALUES)[number]>(
  COLOR_SCHEME_VALUE_ATTR,
  COLOR_SCHEME_VALUES
);

export type ThemePreference = ThemeProviderProps['colorScheme'];

type ThemePreferenceContextValue = {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const ThemePreferenceContext =
  createContext<ThemePreferenceContextValue | null>(null);

export type ThemePreferenceProviderProps = {
  children: ReactNode;
};

export function ThemePreferenceProvider({
  children,
}: ThemePreferenceProviderProps) {
  const [preference, setPreferenceState] = useKvState<ThemePreference>({
    key: COLOR_SCHEME_ROW_KEY,
    default: 'system',
    codec: COLOR_SCHEME_CODEC,
  });

  const setPreference = useCallback(
    (p: ThemePreference) => {
      setPreferenceState(p);
    },
    [setPreferenceState]
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
