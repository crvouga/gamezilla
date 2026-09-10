/** @jsxImportSource solid-js */
/**
 * Theme context and provider.
 *
 * Colors are CSS variables (`tokens.css`), so `ThemeTokens.colors` is a
 * stable palette of `var(--ui-color-*)` references and scheme changes are a
 * single `data-theme` attribute flip on the host element. `palette` exposes
 * the raw resolved scheme for the few components that must compute with real
 * color values (contrast, canvas, SVG fills). Layout (width / height /
 * breakpoint) lives in a second context so a resize never touches token
 * readers.
 */

import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  useContext,
} from 'solid-js';
import { type BreakpointName, getBreakpoint } from './breakpoints';
import type { ColorScheme, ColorTokens } from './colors';
import { COLOR_PALETTE } from './colors';
import { CSS_VAR_COLORS, cssVarElevation } from './css-vars';
import { type FontStacks, fonts } from './fonts';
import { createMediaQuery } from './media-query';
import { type MotionTokens, motion } from './motion';
import type { ElevationLevel, ElevationStyle } from './scale';
import { defaultTextCasing, type TextCasing } from './text-casing';

export type ThemeLayout = {
  width: number;
  height: number;
};

/** Stable design tokens — never change on resize; only `palette` / `colorScheme` track the scheme. */
export type ThemeTokens = {
  /** Palette-shaped map of `var(--ui-color-*)` references. */
  colors: ColorTokens;
  /** Raw resolved scheme colors (for contrast math / canvas / SVG). Reactive. */
  palette: Accessor<ColorTokens>;
  /** Resolved scheme. Reactive. */
  colorScheme: Accessor<ColorScheme>;
  fonts: FontStacks;
  /** Global casing for UI-chrome `Text` variants. */
  textCasing: TextCasing;
  motion: MotionTokens;
  /** Scheme-agnostic elevation: dark mode lifts onto `var(--ui-elevation-N)`. */
  elevation: (level: ElevationLevel) => ElevationStyle;
};

/** Layout metrics — track resize / orientation of the theme host. */
export type ThemeLayoutValue = {
  layout: Accessor<ThemeLayout>;
  /** Current layout bucket from host width. */
  breakpoint: Accessor<BreakpointName>;
};

export type Theme = ThemeTokens & ThemeLayoutValue;

const ThemeTokensContext = createContext<ThemeTokens>();
const ThemeLayoutContext = createContext<ThemeLayoutValue>();

export type ThemeProviderProps = {
  /**
   * `'system'` follows `prefers-color-scheme`; `'light'` / `'dark'` pin the
   * scheme. Reactive.
   */
  colorScheme: ColorScheme | 'system';
  /** Optional font stack overrides (merged onto defaults). Read once. */
  fonts?: Partial<FontStacks>;
  /** Overrides {@link defaultTextCasing} for all design-system `Text`. Read once. */
  textCasing?: TextCasing;
  /**
   * Fixed host size for environments without layout (tests). When omitted the
   * host is measured with `ResizeObserver`.
   */
  fixedLayout?: ThemeLayout;
  children: JSX.Element;
};

const DARK_QUERY = '(prefers-color-scheme: dark)';

function createHostLayout(
  host: () => HTMLElement | undefined,
  fixed: ThemeLayout | undefined
): Accessor<ThemeLayout> {
  const [layout, setLayout] = createSignal<ThemeLayout>(
    fixed ?? { width: 0, height: 0 }
  );
  if (fixed !== undefined || typeof ResizeObserver === 'undefined') {
    return layout;
  }
  createEffect(() => {
    const el = host();
    if (el === undefined) return;
    const apply = (): void => {
      const rect = el.getBoundingClientRect();
      const next = { width: rect.width, height: rect.height };
      setLayout((prev) =>
        prev.width === next.width && prev.height === next.height ? prev : next
      );
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    onCleanup(() => ro.disconnect());
  });
  return layout;
}

export function ThemeProvider(props: ThemeProviderProps): JSX.Element {
  const prefersDark = createMediaQuery(DARK_QUERY);
  const colorScheme = createMemo((): ColorScheme => {
    const wanted = props.colorScheme;
    if (wanted !== 'system') return wanted;
    return prefersDark() ? 'dark' : 'light';
  });
  const palette = createMemo(() => COLOR_PALETTE[colorScheme()]);

  // Portals mount outside the host element, so mirror the scheme on <html>
  // for anything rendered on `document.body`.
  createEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', colorScheme());
  });

  // Static options: read once by design.
  // eslint-disable-next-line solid/reactivity -- static configuration
  const mergedFonts: FontStacks = { ...fonts, ...props.fonts };
  // eslint-disable-next-line solid/reactivity -- static configuration
  const textCasing = props.textCasing ?? defaultTextCasing;

  const tokens: ThemeTokens = {
    colors: CSS_VAR_COLORS,
    palette,
    colorScheme,
    fonts: mergedFonts,
    textCasing,
    motion,
    elevation: cssVarElevation,
  };

  const [host, setHost] = createSignal<HTMLElement>();
  // eslint-disable-next-line solid/reactivity -- static configuration
  const layout = createHostLayout(host, props.fixedLayout);
  const breakpoint = createMemo(() => getBreakpoint(layout().width));
  const layoutValue: ThemeLayoutValue = { layout, breakpoint };

  return (
    <ThemeTokensContext.Provider value={tokens}>
      <ThemeLayoutContext.Provider value={layoutValue}>
        <div
          ref={setHost}
          data-theme={colorScheme()}
          data-component="ThemeProvider"
          style={{
            display: 'flex',
            'flex-direction': 'column',
            flex: '1 1 0%',
            'min-height': '0',
            'min-width': '0',
            'font-family': mergedFonts.sans,
            color: tokens.colors.text,
            background: tokens.colors.background,
          }}
        >
          {props.children}
        </div>
      </ThemeLayoutContext.Provider>
    </ThemeTokensContext.Provider>
  );
}

/** Design tokens only — never re-runs on container resize. */
export function useThemeTokens(): ThemeTokens {
  const ctx = useContext(ThemeTokensContext);
  if (ctx === undefined) {
    throw new Error(
      'ThemeTokens: provider missing — wrap the tree with ThemeProvider'
    );
  }
  return ctx;
}

/** Layout metrics — track resize / orientation. */
export function useThemeLayout(): ThemeLayoutValue {
  const ctx = useContext(ThemeLayoutContext);
  if (ctx === undefined) {
    throw new Error(
      'ThemeLayout: provider missing — wrap the tree with ThemeProvider'
    );
  }
  return ctx;
}

/** Combined theme; prefer {@link useThemeTokens} when layout is unused. */
export function useTheme(): Theme {
  return { ...useThemeTokens(), ...useThemeLayout() };
}
