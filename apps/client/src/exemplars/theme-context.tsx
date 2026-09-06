/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import {
  type Accessor,
  createContext,
  createSignal,
  type ParentProps,
  useContext,
} from 'solid-js';

export type Scheme = 'dark' | 'light';

export type ThemeSchemeContextValue = {
  scheme: Accessor<Scheme>;
  toggle: () => void;
};

const ThemeSchemeContext = createContext<ThemeSchemeContextValue>();

/** Exemplar: context provider owning a signal; consumers read via accessor. */
export function ThemeSchemeProvider(props: ParentProps<{ initial?: Scheme }>) {
  const [scheme, setScheme] = createSignal<Scheme>(props.initial ?? 'dark');
  const value: ThemeSchemeContextValue = {
    scheme,
    toggle: () => setScheme((s) => (s === 'dark' ? 'light' : 'dark')),
  };
  return (
    <ThemeSchemeContext.Provider value={value}>
      {props.children}
    </ThemeSchemeContext.Provider>
  );
}

export function useThemeScheme(): ThemeSchemeContextValue {
  const ctx = useContext(ThemeSchemeContext);
  if (ctx === undefined) {
    throw new Error('useThemeScheme must be used within ThemeSchemeProvider');
  }
  return ctx;
}

export function ThemeToggle() {
  const theme = useThemeScheme();
  return (
    <button
      type="button"
      data-component="ThemeToggle"
      data-scheme={theme.scheme()}
      onClick={() => theme.toggle()}
    >
      <Trans>Toggle theme</Trans>
    </button>
  );
}
