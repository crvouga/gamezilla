import { observeElementResize } from '../observe-element-resize';
/** @jsxImportSource @solidjs/web */
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

import type { BreakpointName } from '@pkgs/ui-root-shared-ts/breakpoints';
import { getBreakpoint } from '@pkgs/ui-root-shared-ts/breakpoints';
import { COLOR_PALETTE } from '@pkgs/ui-root-shared-ts/color-palette';
import type {
  ColorScheme,
  ColorTokens,
} from '@pkgs/ui-root-shared-ts/colors-types';
import {
  CSS_VAR_COLORS,
  cssVarElevation,
} from '@pkgs/ui-root-shared-ts/css-vars';
import type { FontStacks } from '@pkgs/ui-root-shared-ts/fonts';
import { fonts } from '@pkgs/ui-root-shared-ts/fonts';
import type { MotionTokens } from '@pkgs/ui-root-shared-ts/motion';
import { motion } from '@pkgs/ui-root-shared-ts/motion';
import type {
  ElevationLevel,
  ElevationStyle,
} from '@pkgs/ui-root-shared-ts/scale';
import type { TextCasing } from '@pkgs/ui-root-shared-ts/text-casing';
import { defaultTextCasing } from '@pkgs/ui-root-shared-ts/text-casing';
import type { JSX } from '@solidjs/web';
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  untrack,
  useContext,
} from 'solid-js';
import { createMediaQuery } from '../media-query';

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

// `null` outside any provider: the outermost provider reads it to know it is the root.
const ThemeTokensContext = createContext<ThemeTokens | null>(null);
const ThemeLayoutContext = createContext<ThemeLayoutValue>();
const ThemeHostContext = createContext<Accessor<HTMLElement | undefined>>(
  () => undefined
);

export type ThemeProviderProps = {
  /** An injected device preference; browser CSS also follows the system preference. */
  reducedMotion?: boolean;
  /**
   * `'system'` follows `prefers-color-scheme`; `'light'` / `'dark'` pin the
   * scheme. Reactive.
   */
  colorScheme: ColorScheme | 'system';
  /** Independent overlay roots may follow the document without owning it. */
  manageDocumentTheme?: boolean;
  /** Keep overlay roots transparent while retaining theme tokens. */
  transparent?: boolean;
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

/** Host overrides for `--ui-font-*`. Omitted when the caller keeps defaults. */
function themeFontStyle(
  overrides: Partial<FontStacks> | undefined,
  merged: FontStacks
): JSX.CSSProperties | undefined {
  if (overrides === undefined) return undefined;
  return {
    '--ui-font-sans': merged.sans,
    '--ui-font-display': merged.display,
    '--ui-font-mono': merged.mono,
  };
}

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
  createEffect(host, (el) => {
    if (el === undefined) return undefined;
    const apply = (): void => {
      const rect = el.getBoundingClientRect();
      const next = { width: rect.width, height: rect.height };
      setLayout((prev) =>
        prev.width === next.width && prev.height === next.height ? prev : next
      );
    };
    apply();
    return observeElementResize(el, apply);
  });
  return layout;
}

function mirrorDocumentTheme(scheme: ColorScheme): () => void {
  const root = document.documentElement;
  const previous = root.getAttribute('data-theme');
  root.setAttribute('data-theme', scheme);
  return () => {
    if (previous === null) root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', previous);
  };
}

/**
 * Supply production design tokens and responsive layout context to a component
 * tree. Nested providers can pin a scheme without changing the document theme.
 * @summary Provide theme tokens and responsive layout context
 */
export function ThemeProvider(props: ThemeProviderProps): JSX.Element {
  // Nested providers compose via host `data-theme` + Solid context only —
  // never fight over `<html>`. In-repo portals mount inside the host.
  const isRoot = useContext(ThemeTokensContext) === null;
  const prefersDark = createMediaQuery(DARK_QUERY);
  const colorScheme = createMemo((): ColorScheme => {
    const wanted = props.colorScheme;
    if (wanted !== 'system') return wanted;
    return prefersDark() ? 'dark' : 'light';
  });
  const palette = createMemo(() => COLOR_PALETTE[colorScheme()]);

  if (isRoot) {
    createEffect(
      () =>
        typeof document === 'undefined' || props.manageDocumentTheme === false
          ? undefined
          : colorScheme(),
      (scheme) =>
        scheme === undefined ? undefined : mirrorDocumentTheme(scheme)
    );
  }

  // Static options: `fonts`, `textCasing` and `fixedLayout` are read once by
  // design, so a later change to them is ignored.
  const fixed = untrack(() => ({
    fonts: props.fonts,
    textCasing: props.textCasing,
    layout: props.fixedLayout,
  }));
  const mergedFonts: FontStacks = { ...fonts, ...fixed.fonts };
  const fontStyle = themeFontStyle(fixed.fonts, mergedFonts);
  const textCasing = fixed.textCasing ?? defaultTextCasing;

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
  const layout = createHostLayout(host, fixed.layout);
  const breakpoint = createMemo(() => getBreakpoint(layout().width));
  const layoutValue: ThemeLayoutValue = { layout, breakpoint };

  return (
    <ThemeTokensContext value={tokens}>
      <ThemeLayoutContext value={layoutValue}>
        <ThemeHostContext value={host}>
          <div
            ref={setHost}
            class={[
              'themeHost',
              {
                'bg-transparent': props.transparent === true,
                'bg-none': props.transparent === true,
              },
            ]}
            data-theme={colorScheme()}
            data-reduced-motion={
              props.reducedMotion === true ? 'true' : undefined
            }
            data-component="ThemeProvider"
            style={fontStyle}
          >
            {props.children}
          </div>
        </ThemeHostContext>
      </ThemeLayoutContext>
    </ThemeTokensContext>
  );
}

/** Design tokens only — never re-runs on container resize. */
export function useThemeTokens(): ThemeTokens {
  const ctx = useContext(ThemeTokensContext);
  if (ctx === null) {
    throw new Error(
      'ThemeTokens: provider missing — wrap the tree with ThemeProvider'
    );
  }
  return ctx;
}

/** Layout metrics — track resize / orientation. */
export function useThemeLayout(): ThemeLayoutValue {
  return useContext(ThemeLayoutContext);
}

/**
 * The element the nearest theme draws the app in: everything the app shows
 * on screen, with its theme. `undefined` before it mounts or outside one.
 */
export function useThemeHost(): Accessor<HTMLElement | undefined> {
  return useContext(ThemeHostContext);
}

/** Combined theme; prefer {@link useThemeTokens} when layout is unused. */
export function useTheme(): Theme {
  return { ...useThemeTokens(), ...useThemeLayout() };
}
