/**
 * DiceBear style registry.
 * Nuclear overhaul: named imports from `@dicebear/collection` (not
 * `import * as collection`) so unused symbols can be dropped when the
 * module graph allows.
 */

import {
  adventurer,
  adventurerNeutral,
  avataaars,
  avataaarsNeutral,
  bigEars,
  bigEarsNeutral,
  bigSmile,
  bottts,
  botttsNeutral,
  croodles,
  croodlesNeutral,
  dylan,
  funEmoji,
  glass,
  icons,
  identicon,
  initials,
  lorelei,
  loreleiNeutral,
  micah,
  miniavs,
  notionists,
  notionistsNeutral,
  openPeeps,
  personas,
  pixelArt,
  pixelArtNeutral,
  rings,
  shapes,
  thumbs,
  toonHead,
} from '@dicebear/collection';
import type { Style } from '@dicebear/core';

/**
 * All DiceBear v9 styles, keyed by export name.
 */
export const STYLES = {
  adventurer,
  adventurerNeutral,
  avataaars,
  avataaarsNeutral,
  bigEars,
  bigEarsNeutral,
  bigSmile,
  bottts,
  botttsNeutral,
  croodles,
  croodlesNeutral,
  dylan,
  funEmoji,
  glass,
  icons,
  identicon,
  initials,
  lorelei,
  loreleiNeutral,
  micah,
  miniavs,
  notionists,
  notionistsNeutral,
  openPeeps,
  personas,
  pixelArt,
  pixelArtNeutral,
  rings,
  shapes,
  thumbs,
  toonHead,
} as const;

export type StyleKey = keyof typeof STYLES;

export const STYLE_KEYS = Object.keys(STYLES) as StyleKey[];

const ACRONYMS = new Set(['svg', 'ui', 'api']);

/** Human-readable label for a style key (e.g. `pixelArt` → "Pixel art"). */
export function styleLabel(key: StyleKey): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^[a-z]/, (c) => c.toUpperCase())
    .split(' ')
    .map((word) =>
      ACRONYMS.has(word.toLowerCase()) ? word.toUpperCase() : word
    )
    .join(' ');
}

export function getStyleOrDefault(key: string): Style<Record<string, unknown>> {
  if (key in STYLES) {
    return STYLES[key as StyleKey] as Style<Record<string, unknown>>;
  }
  return STYLES.funEmoji as Style<Record<string, unknown>>;
}

export function isStyleKey(key: string): key is StyleKey {
  return key in STYLES;
}
