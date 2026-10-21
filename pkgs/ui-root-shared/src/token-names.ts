// GENERATED from pkgs/ui-root-shared/src/design-tokens.json — do not edit.

/** Gap and padding steps (`--ui-space-<name>`). */
export const SPACE_TOKENS = [
  'none',
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
  '3xl',
] as const;
export type SpaceToken = (typeof SPACE_TOKENS)[number];

/** Corner radius by hierarchy (`--ui-radius-<name>`). */
export const RADIUS_TOKENS = [
  'none',
  'sm',
  'control',
  'card',
  'sheet',
  'full',
] as const;
export type RadiusToken = (typeof RADIUS_TOKENS)[number];

/** Text and glyph color roles. `inherit` takes the parent color. */
export const COLOR_TONES = [
  'default',
  'secondary',
  'tint',
  'destructive',
  'success',
  'warning',
  'info',
  'on-primary',
  'inherit',
] as const;
export type ColorTone = (typeof COLOR_TONES)[number];

/** Fill color roles of a painted container. */
export const SURFACE_TONES = [
  'background',
  'surface',
  'muted',
  'elevated',
  'overlay',
  'tint-subtle',
  'destructive',
  'success',
  'warning',
  'info',
  'transparent',
] as const;
export type SurfaceTone = (typeof SURFACE_TONES)[number];

/** Glyph box sizes (`--ui-icon-size-<name>`). */
export const ICON_SIZE_TOKENS = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const;
export type IconSizeToken = (typeof ICON_SIZE_TOKENS)[number];

/** Minimum viewport widths a responsive prop may branch on. */
export const BREAKPOINT_TOKENS = ['sm', 'md', 'lg', 'xl'] as const;
export type BreakpointToken = (typeof BREAKPOINT_TOKENS)[number];

/** Control heights (`--ui-control-size-<name>`). */
export const CONTROL_SIZE_TOKENS = ['sm', 'md', 'lg'] as const;
export type ControlSizeToken = (typeof CONTROL_SIZE_TOKENS)[number];

/** Reading and layout measures (`--ui-max-width-<name>`). */
export const MAX_WIDTH_TOKENS = [
  'prose',
  'form',
  'content',
  'wide',
  'full',
] as const;
export type MaxWidthToken = (typeof MAX_WIDTH_TOKENS)[number];

/** Transition durations (`--ui-duration-<name>`). */
export const DURATION_TOKENS = ['instant', 'fast', 'normal', 'slow'] as const;
export type DurationToken = (typeof DURATION_TOKENS)[number];

/** Transition curves (`--ui-easing-<name>`). */
export const EASING_TOKENS = ['standard'] as const;
export type EasingToken = (typeof EASING_TOKENS)[number];

/** Stacking layers, lowest first (`--ui-layer-<name>`). */
export const LAYER_TOKENS = [
  'surface',
  'overlay',
  'tooltip',
  'harness-browser',
] as const;
export type LayerToken = (typeof LAYER_TOKENS)[number];
