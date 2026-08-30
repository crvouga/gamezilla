/**
 * Theme context and provider.
 * Resolves `colorScheme: 'system'` via React Native appearance.
 *
 * Nuclear overhaul: tokens (colors, sx, motion, elevation) live in a
 * separate context from layout (width/height/breakpoint) so resize /
 * orientation does not rebuild every `useThemeTokens()` consumer.
 */

import { assert } from '@pkgs/assert';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  type LayoutChangeEvent,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { type BreakpointName, getBreakpoint } from './breakpoints';
import type { ColorScheme, ColorTokens } from './colors';
import { COLOR_PALETTE } from './colors';
import { type FontStacks, fonts } from './fonts';
import { type Motion, motion } from './motion';
import {
  type ElevationLevel,
  type ElevationStyle,
  makeElevation,
} from './scale';
import { createSx } from './sx';
import type { SxInput } from './sx-props';
import { sxToCss } from './sx-to-css';
import { defaultTextCasing, type TextCasing } from './text-casing';

export type ThemeLayout = {
  width: number;
  height: number;
  scale: number;
  fontScale: number;
};

/** Stable design tokens — does not change on resize. */
export type ThemeTokens = {
  /** RN host compiler — only host adapters and tests should call this. */
  sx: ReturnType<typeof createSx>;
  /** CSS compiler for HTML reports / `dataSet.css` capture. */
  css: (input: SxInput) => string;
  colors: ColorTokens;
  colorScheme: ColorScheme;
  fonts: FontStacks;
  /** Global casing for {@link Text} (overridable per node via `sx` / `style`). */
  textCasing: TextCasing;
  /** Motion design tokens (durations, easings). */
  motion: Motion;
  /**
   * Scheme-aware elevation. Nuclear overhaul: no boxShadow; dark mode may
   * return a surface lift `backgroundColor` only.
   */
  elevation: (level: ElevationLevel) => ElevationStyle;
};

/** Layout metrics — changes on resize / orientation. */
export type ThemeLayoutValue = {
  layout: ThemeLayout;
  /** Current layout bucket from container (layout) width. */
  breakpoint: BreakpointName;
};

/** Combined theme for backwards-compatible {@link useTheme}. */
export type Theme = ThemeTokens & ThemeLayoutValue;

const ThemeTokensContext = createContext<ThemeTokens | null>(null);
const ThemeLayoutContext = createContext<ThemeLayoutValue | null>(null);

type MeasuredSize = {
  readonly width: number;
  readonly height: number;
};

export type ThemeProviderProps = {
  /**
   * Use `'system'` to follow the OS appearance (resolved inside the provider).
   * Pass `'light'` or `'dark'` for a fixed scheme.
   */
  colorScheme: ColorScheme | 'system';
  /**
   * When `colorScheme` is `'system'` and RN reports no preference, use this.
   */
  systemFallback?: ColorScheme;
  children: ReactNode;
  /** Optional color overrides per scheme */
  colors?: Partial<Record<ColorScheme, Partial<ColorTokens>>>;
  /** Optional font stack overrides (merged onto defaults) */
  fonts?: Partial<FontStacks>;
  /** Overrides {@link defaultTextCasing} for all design-system `Text`. */
  textCasing?: TextCasing;
};

export function ThemeProvider({
  colorScheme: colorSchemeProp,
  systemFallback = 'light',
  children,
  colors: colorOverrides,
  fonts: fontsProp,
  textCasing: textCasingProp,
}: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const windowLayout = useWindowDimensions();
  const [measured, setMeasured] = useState<MeasuredSize | null>(null);

  const onHostLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setMeasured((prev) => {
      if (prev !== null && prev.width === width && prev.height === height) {
        return prev;
      }
      return { width, height };
    });
  }, []);

  const resolvedScheme: ColorScheme = useMemo(() => {
    if (colorSchemeProp !== 'system') {
      return colorSchemeProp;
    }
    if (systemScheme === 'dark' || systemScheme === 'light') {
      return systemScheme;
    }
    return systemFallback;
  }, [colorSchemeProp, systemScheme, systemFallback]);

  const tokens = useMemo((): ThemeTokens => {
    const base = COLOR_PALETTE[resolvedScheme];
    const overrides = colorOverrides?.[resolvedScheme];
    const colors: ColorTokens = overrides ? { ...base, ...overrides } : base;
    const mergedFonts: FontStacks = fontsProp
      ? { ...fonts, ...fontsProp }
      : fonts;
    const textCasing = textCasingProp ?? defaultTextCasing;
    const elevation = makeElevation(colors, resolvedScheme);
    return {
      sx: createSx(colors, {
        elevation,
        hairlineWidth: StyleSheet.hairlineWidth,
      }),
      css: (input: SxInput) => sxToCss(input, { colors, elevation }),
      colors,
      colorScheme: resolvedScheme,
      fonts: mergedFonts,
      textCasing,
      motion,
      elevation,
    };
  }, [resolvedScheme, colorOverrides, fontsProp, textCasingProp]);

  const layoutValue = useMemo((): ThemeLayoutValue => {
    const width =
      measured !== null && measured.width > 0
        ? measured.width
        : windowLayout.width;
    const height =
      measured !== null && measured.height > 0
        ? measured.height
        : windowLayout.height;
    return {
      layout: {
        width,
        height,
        scale: windowLayout.scale,
        fontScale: windowLayout.fontScale,
      },
      breakpoint: getBreakpoint(width),
    };
  }, [
    measured,
    windowLayout.height,
    windowLayout.width,
    windowLayout.scale,
    windowLayout.fontScale,
  ]);

  return (
    <ThemeTokensContext.Provider value={tokens}>
      <ThemeLayoutContext.Provider value={layoutValue}>
        <View style={hostStyle} onLayout={onHostLayout}>
          {children}
        </View>
      </ThemeLayoutContext.Provider>
    </ThemeTokensContext.Provider>
  );
}

const hostStyle = {
  flex: 1,
  minHeight: 0,
  minWidth: 0,
} as const;

/** Design tokens only — does not re-render on container resize. */
export function useThemeTokens(): ThemeTokens {
  const ctx = useContext(ThemeTokensContext);
  assert.defined(ctx, 'ThemeTokensContext must be defined');
  return ctx;
}

/** Layout metrics — changes on resize / orientation. */
export function useThemeLayout(): ThemeLayoutValue {
  const ctx = useContext(ThemeLayoutContext);
  assert.defined(ctx, 'ThemeLayoutContext must be defined');
  return ctx;
}

/**
 * Combined theme. Prefer {@link useThemeTokens} when layout is unused so
 * resize does not re-render the consumer.
 */
export function useTheme(): Theme {
  const tokens = useThemeTokens();
  const layout = useThemeLayout();
  return useMemo(() => ({ ...tokens, ...layout }), [tokens, layout]);
}
