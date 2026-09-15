/**
 * App-wide layout tokens for the desktop (wide) flat column shell.
 *
 * Compact (mobile / tablet) screens ignore these — they keep ScreenBase's
 * existing edge padding. Wide mode uses them for the centered AppFrame column.
 */

/** Max content width for the desktop AppFrame column (CSS px / dp). */
export const APP_MAX_WIDTH = 1200;

/** Spacing-scale step for AppFrame gutters (1 = 4px → 16px). */
export const APP_FRAME_GUTTER_STEP = 4;

/** Spacing-scale step for Island content padding (1 = 4px → 16px). */
export const ISLAND_PADDING_STEP = 4;

/** Spacing-scale step between AppFrame header+body and stacked sections (1 = 4px → 8px). */
export const ISLAND_GAP_STEP = 2;
