/**
 * Prebuilt light/dark color palettes.
 * App-agnostic; copy-paste into any React Native app.
 */

export type ColorScheme = 'light' | 'dark';

export type ColorTokens = {
  // Surfaces (lowest -> highest visual elevation)
  background: string;
  surface: string;
  /** Sunken variant -- input fills, code blocks, recessed regions. */
  surfaceMuted: string;
  /** Raised above `surface` -- modals, raised cards. */
  surfaceElevated: string;
  /** Floating above content -- popovers, dropdowns, floating menus. */
  surfaceOverlay: string;

  // Foreground
  text: string;
  textSecondary: string;
  icon: string;

  // Brand / interactive
  tint: string;
  tintHover: string;
  tintActive: string;
  /** Very low-alpha tint for selected backgrounds / chip pills. */
  tintSubtle: string;
  /** Higher-alpha tint -- legacy alias retained for chips, switches, etc. */
  tintMuted: string;
  /** Readable foreground on top of `tint` per scheme. */
  onTint: string;

  // Interactive overlays for hover/press (composited over any surface)
  interactiveHover: string;
  interactivePress: string;

  // Borders + chrome
  border: string;
  outline: string;
  focusRing: string;

  // Tab bar
  tabIconDefault: string;
  tabIconSelected: string;

  // Semantic + matching subtle surfaces
  destructive: string;
  destructiveSurface: string;
  success: string;
  successSurface: string;
  warning: string;
  warningSurface: string;
  info: string;
  infoSurface: string;

  // States
  disabled: string;

  // Overlays + elevation
  /** Modal / floating-menu backdrop. */
  scrim: string;
  /** Base color for `theme.elevation()` shadows. */
  shadowColor: string;

  /** Subtle brand gradient (two close, dark stops for light text on top). */
  gradientPrimaryStart: string;
  gradientPrimaryEnd: string;
  /** Danger/destructive gradient (dark stops in both schemes). */
  gradientDangerStart: string;
  gradientDangerEnd: string;
  /** Neutral/secondary gradient (dark stops in both schemes). */
  gradientNeutralStart: string;
  gradientNeutralEnd: string;
};

export type ColorTokenName = keyof ColorTokens;

export type ColorPalette = Record<ColorScheme, ColorTokens>;
