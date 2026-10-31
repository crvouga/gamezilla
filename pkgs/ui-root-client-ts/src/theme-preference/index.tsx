/** @jsxImportSource solid-js */

import { asKeyword } from '@pkgs/keyword-shared-ts/keyword';
import { createKvState } from '@pkgs/kv-root-client-ts/solid';
import { enumKvCodec } from '@pkgs/kv-root-shared-ts/kv-state-codec';
import {
  type Accessor,
  createContext,
  createSignal,
  type JSX,
  useContext,
} from 'solid-js';
import type { ThemeProviderProps } from '../theme-context/index';

const COLOR_SCHEME_ROW_KEY = asKeyword('ui.prefs/color-scheme');
const COLOR_SCHEME_VALUE_ATTR = asKeyword('ui.prefs/value');
const COLOR_SCHEME_VALUES = ['light', 'dark', 'system'] as const;
const COLOR_SCHEME_CODEC = enumKvCodec<(typeof COLOR_SCHEME_VALUES)[number]>(
  COLOR_SCHEME_VALUE_ATTR,
  COLOR_SCHEME_VALUES
);

export type ThemePreference = ThemeProviderProps['colorScheme'];

export type ThemePreferenceContextValue = {
  preference: Accessor<ThemePreference>;
  setPreference: (p: ThemePreference) => void;
  /** False until the stored preference has been read or a choice is made. */
  settled: Accessor<boolean>;
};

const ThemePreferenceContext = createContext<ThemePreferenceContextValue>();

/**
 * Light / dark / system preference persisted via {@link createKvState}
 * (through any ambient `<KvProvider>`). Without a provider it falls back to
 * in-memory state.
 */
export function ThemePreferenceProvider(props: {
  children: JSX.Element;
}): JSX.Element {
  const [settled, setSettled] = createSignal(false);
  const [preference, setStored] = createKvState<ThemePreference>({
    key: COLOR_SCHEME_ROW_KEY,
    default: 'system',
    codec: COLOR_SCHEME_CODEC,
    onHydrated: () => setSettled(true),
  });
  const setPreference = (next: ThemePreference): void => {
    setSettled(true);
    setStored(next);
  };
  return (
    <ThemePreferenceContext.Provider
      value={{ preference, setPreference, settled }}
    >
      {props.children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreferenceContextValue {
  const ctx = useContext(ThemePreferenceContext);
  if (ctx === undefined) {
    throw new Error(
      'useThemePreference must be used within ThemePreferenceProvider'
    );
  }
  return ctx;
}
