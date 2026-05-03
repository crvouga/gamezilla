import * as collection from '@dicebear/collection';
import type { Style } from '@dicebear/core';

/**
 * All DiceBear v9 styles from `@dicebear/collection`, keyed by export name.
 */
export const STYLES = {
  adventurer: collection.adventurer,
  adventurerNeutral: collection.adventurerNeutral,
  avataaars: collection.avataaars,
  avataaarsNeutral: collection.avataaarsNeutral,
  bigEars: collection.bigEars,
  bigEarsNeutral: collection.bigEarsNeutral,
  bigSmile: collection.bigSmile,
  bottts: collection.bottts,
  botttsNeutral: collection.botttsNeutral,
  croodles: collection.croodles,
  croodlesNeutral: collection.croodlesNeutral,
  dylan: collection.dylan,
  funEmoji: collection.funEmoji,
  glass: collection.glass,
  icons: collection.icons,
  identicon: collection.identicon,
  initials: collection.initials,
  lorelei: collection.lorelei,
  loreleiNeutral: collection.loreleiNeutral,
  micah: collection.micah,
  miniavs: collection.miniavs,
  notionists: collection.notionists,
  notionistsNeutral: collection.notionistsNeutral,
  openPeeps: collection.openPeeps,
  personas: collection.personas,
  pixelArt: collection.pixelArt,
  pixelArtNeutral: collection.pixelArtNeutral,
  rings: collection.rings,
  shapes: collection.shapes,
  thumbs: collection.thumbs,
  toonHead: collection.toonHead,
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
  return STYLES.lorelei as Style<Record<string, unknown>>;
}

export function isStyleKey(key: string): key is StyleKey {
  return key in STYLES;
}
