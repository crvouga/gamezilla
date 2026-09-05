/**
 * App-wide layout tokens for the desktop (wide) island shell.
 *
 * Compact (mobile / tablet) screens ignore these — they keep ScreenBase's
 * existing edge padding. Wide mode uses them for the centered AppFrame column
 * and Island card chrome.
 */

import type { BorderRadiusKey } from './scale';

/** Max content width for the desktop AppFrame column (CSS px / dp). */
export const APP_MAX_WIDTH = 1200;

/** Spacing-scale step for AppFrame gutters (1 = 4px → 24px). */
export const APP_FRAME_GUTTER_STEP = 6;

/** Spacing-scale step for Island card padding (1 = 4px → 20px). */
export const ISLAND_PADDING_STEP = 5;

/** Spacing-scale step between islands / AppFrame header+body (1 = 4px → 16px). */
export const ISLAND_GAP_STEP = 4;

/** Border radius token for Island / AppHeaderIsland cards. */
export const ISLAND_RADIUS: BorderRadiusKey = 'xl';
