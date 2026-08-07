/**
 * On-color context -- propagates a contrast-safe foreground set down the tree.
 *
 * Colored surfaces (gradients, brand fills, avatars, solid buttons) wrap their
 * children in an {@link OnColorProvider}; `Text` and icons then read
 * {@link useOnColor} to pick a legible default color automatically, instead of
 * falling back to the near-black `text` token (invisible on a saturated fill)
 * or a hardcoded `#fff` (which under-contrasts on lighter dark-mode fills).
 *
 * When no provider is present, {@link useOnColor} returns the theme's normal
 * `text` / `textSecondary` / `icon` colors, so ordinary screens are unchanged.
 */

import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { bestOnColor, type OnColorSet } from './colors';
import { useTheme } from './theme-context';

const OnColorContext = createContext<OnColorSet | null>(null);

/**
 * Current contrast-safe foreground set. Outside any {@link OnColorProvider}
 * this resolves to the theme's standard text colors.
 */
export function useOnColor(): OnColorSet {
  const ctx = useContext(OnColorContext);
  const theme = useTheme();
  if (ctx) return ctx;
  return {
    fg: theme.colors.text,
    fgMuted: theme.colors.textSecondary,
    icon: theme.colors.icon,
  };
}

/**
 * Break out of a parent {@link OnColorProvider} so neutral surfaces (modals,
 * sheets, menus) pick up the theme's standard `text` / `textSecondary` /
 * `icon` instead of a colored ancestor's white-on-gradient foreground.
 */
export function OnColorReset({ children }: { children: ReactNode }): ReactNode {
  return (
    <OnColorContext.Provider value={null}>{children}</OnColorContext.Provider>
  );
}

export type OnColorProviderProps = {
  /**
   * Background the children sit on. The provider derives the best-contrast
   * foreground set from this color. Ignored when `value` is supplied.
   */
  background?: string;
  /** Explicit foreground set, overriding `background`-based derivation. */
  value?: OnColorSet;
  children: ReactNode;
};

/**
 * Provide a contrast-safe foreground set to descendants. Pass `background`
 * to auto-derive it, or `value` to set it explicitly.
 */
export function OnColorProvider({
  background,
  value,
  children,
}: OnColorProviderProps): ReactNode {
  const resolved = useMemo<OnColorSet | null>(() => {
    if (value) return value;
    if (background !== undefined) return bestOnColor(background);
    return null;
  }, [value, background]);

  return (
    <OnColorContext.Provider value={resolved}>
      {children}
    </OnColorContext.Provider>
  );
}
