import type { color } from './design-tokens.json';

/**
 * Prebuilt light/dark color palettes.
 */

export type ColorScheme = 'light' | 'dark';

type GameColorName = Extract<keyof typeof color.light, `game${string}`>;

export type ColorTokens = Record<GameColorName, string> & {
  // Surfaces (lowest -> highest visual elevation)
  background: string;
  surface: string;
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
  /** Selected chip, active turn, active player, your avatar (`primary-soft`). */
  tintSubtle: string;
  /** Selected borders, active indicators, the viewer's pieces. */
  primaryStrong: string;
  /** Text and initials on `tintSubtle`. */
  onPrimarySoft: string;
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

  /** Only the LIVE pill and recording dot. */
  live: string;
  /** Label on `live`. */
  onLive: string;

  // Labeled game paths and endpoints; never application chrome.
  pathRed: string;
  pathOrange: string;
  pathYellow: string;
  pathGreen: string;
  pathBlue: string;
  pathPurple: string;

  // Seat colors in multiplayer games, spaced by lightness; never chrome.
  player1: string;
  player2: string;
  player3: string;
  player4: string;
  player5: string;
  player6: string;
  player7: string;
  player8: string;

  // Neutral board surfaces, the same roles in both schemes.
  boardLight: string;
  boardDark: string;
  boardHighlight: string;
  boardCell: string;
  boardCardFace: string;
  boardCardInk: string;
  boardCardInkRed: string;

  // States
  disabled: string;

  // Overlays + elevation
  /** Modal / floating-menu backdrop. */
  scrim: string;
  /** Color of the one floating shadow (`--ui-shadow-float`). */
  shadowColor: string;
};

export type ColorTokenName = keyof ColorTokens;

export type ColorPalette = Record<ColorScheme, ColorTokens>;
