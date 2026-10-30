/** @jsxImportSource solid-js */
/**
 * On-color context -- propagates a contrast-safe foreground set down the tree.
 *
 * Colored surfaces (gradients, brand fills, avatars, solid buttons) wrap their
 * children in an {@link OnColorProvider}; text/CSS (`--ui-on-fg*`) and icons
 * (`useOnColor`) then pick a legible default color automatically.
 *
 * When no provider is present, colors fall back to the theme's normal
 * `text` / `textSecondary` / `icon` variables.
 */

import type { OnColorSet } from '@pkgs/ui-root-shared-ts/contrast';
import { bestOnColor } from '@pkgs/ui-root-shared-ts/contrast';
import {
  type Accessor,
  createContext,
  createMemo,
  type JSX,
  useContext,
} from 'solid-js';
import { useThemeTokens } from '../theme-context/index';

const OnColorContext = createContext<Accessor<OnColorSet | null>>();

/** Current contrast-safe foreground set (reactive). */
export function useOnColor(): Accessor<OnColorSet> {
  const ctx = useContext(OnColorContext);
  const tokens = useThemeTokens();
  const fallback: OnColorSet = {
    fg: tokens.colors.text,
    fgMuted: tokens.colors.textSecondary,
    icon: tokens.colors.icon,
  };
  if (ctx === undefined) return () => fallback;
  return () => ctx() ?? fallback;
}

function onColorCssVars(set: OnColorSet | null): JSX.CSSProperties {
  if (set === null) {
    return {
      display: 'contents',
      '--ui-on-fg': 'var(--ui-color-text)',
      '--ui-on-fg-muted': 'var(--ui-color-text-secondary)',
      '--ui-on-icon': 'var(--ui-color-icon)',
    };
  }
  return {
    display: 'contents',
    '--ui-on-fg': set.fg,
    '--ui-on-fg-muted': set.fgMuted,
    '--ui-on-icon': set.icon,
  };
}

/**
 * Break out of a parent {@link OnColorProvider} so neutral surfaces (modals,
 * sheets, menus) pick up the theme's standard foreground.
 */
export function OnColorReset(props: { children: JSX.Element }): JSX.Element {
  return (
    <OnColorContext.Provider value={() => null}>
      <div style={onColorCssVars(null)}>{props.children}</div>
    </OnColorContext.Provider>
  );
}

export type OnColorProviderProps = {
  /**
   * Background the children sit on (a concrete CSS color, not a `var()`).
   * The provider derives the best-contrast foreground set from it. Ignored
   * when `value` is supplied.
   */
  background?: string;
  /** Composite a translucent `background` over this before contrast math. */
  backdrop?: string;
  /** Explicit foreground set, overriding `background`-based derivation. */
  value?: OnColorSet;
  children: JSX.Element;
};

export function OnColorProvider(props: OnColorProviderProps): JSX.Element {
  const resolved = createMemo<OnColorSet | null>(() => {
    if (props.value) return props.value;
    if (props.background !== undefined) {
      return bestOnColor(
        props.background,
        props.backdrop !== undefined ? { backdrop: props.backdrop } : undefined
      );
    }
    return null;
  });
  return (
    <OnColorContext.Provider value={resolved}>
      <div style={onColorCssVars(resolved())}>{props.children}</div>
    </OnColorContext.Provider>
  );
}
