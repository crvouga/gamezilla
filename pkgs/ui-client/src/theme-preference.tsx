/** @jsxImportSource solid-js */
/**
 * Light / dark / system preference persisted via {@link createKvState}
 * (through any ambient `<KvProvider>`). Without a provider it falls back to
 * in-memory state.
 */

import { asKeyword } from '@pkgs/keyword-shared/keyword';
import { enumKvCodec } from '@pkgs/kv-shared/kv-state-codec';
import { createKvState } from '@pkgs/kv-client/solid';
import { type Accessor, createContext, type JSX, useContext } from 'solid-js';
import type { ThemeProviderProps } from './theme-context';

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
};

const ThemePreferenceContext = createContext<ThemePreferenceContextValue>();

export function ThemePreferenceProvider(props: {
  children: JSX.Element;
}): JSX.Element {
  const [preference, setPreference] = createKvState<ThemePreference>({
    key: COLOR_SCHEME_ROW_KEY,
    default: 'system',
    codec: COLOR_SCHEME_CODEC,
  });
  return (
    <ThemePreferenceContext.Provider value={{ preference, setPreference }}>
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
