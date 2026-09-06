/**
 * Prebuilt light/dark color palettes.
 * App-agnostic; copy-paste into any React Native app.
 */

export type ColorScheme = 'light' | 'dark';

export type ColorTokens = {
  // Surfaces (lowest -> highest visual elevation)
  background: string;
  surface: string;
  /** Deeper than `background` -- the page-level recessed canvas. */
  surfaceSunken: string;
  /** Inline recessed fill -- input fields, code blocks, segmented control track. */
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
  /** Solid tint @ ~12% alpha (or surface mix) for selected pills in dark mode. */
  tintHighlight: string;
  /** High-contrast label/icon on top of saturated `tint`. */
  onPrimary: string;
  /** High-contrast label/icon on top of `destructive`. */
  onDestructive: string;
  /** High-contrast label/icon on top of `success`. */
  onSuccess: string;
  /** High-contrast label/icon on top of `warning` (often dark — yellows need it). */
  onWarning: string;
  /** High-contrast label/icon on top of `info`. */
  onInfo: string;
  /**
   * Translucent dark overlay to place on top of a brand/`tint` gradient
   * (pills, plates) so that `onPrimary` (white) content stays AA-legible
   * regardless of where it falls on the gradient ramp.
   */
  onTintScrim: string;

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
  /**
   * Darker destructive shade for solid fills (danger buttons / badges) so a
   * white `onDestructive` label keeps >= 4.5:1 contrast in both schemes —
   * the bright `destructive` is tuned for foreground/text legibility instead.
   */
  destructiveActive: string;
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
};

export type ColorTokenName = keyof ColorTokens;

export type ColorPalette = Record<ColorScheme, ColorTokens>;
