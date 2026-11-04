/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';

/**
 * `xs` 20px inline beside a name in a bar or a line of text; `sm` 32px in a
 * compact row; `md` 40px beside a row's title; `lg` 48px leading a card.
 */
export type MonogramTileSize = 'xs' | 'sm' | 'md' | 'lg';

/**
 * The paints a tile may take: the player and status hues whose canvas-ink
 * letter holds AA in both schemes (never the white or black seat, never
 * the indigo of what is chosen).
 */
export const MONOGRAM_PAINTS = [
  'player1',
  'player3',
  'player4',
  'player7',
  'success',
  'warning',
] as const;

export type MonogramPaint = (typeof MONOGRAM_PAINTS)[number];

const PAINT_CLASS: Readonly<Record<MonogramPaint, string>> = {
  player1: 'bg-player1',
  player3: 'bg-player3',
  player4: 'bg-player4',
  player7: 'bg-player7',
  success: 'bg-success',
  warning: 'bg-warning',
};

const SIZE: Readonly<Record<MonogramTileSize, string>> = {
  xs: 'size-5 rounded-sm textLabel',
  sm: 'size-8 rounded-control textBodyBold',
  md: 'size-10 rounded-control textRowTitle',
  lg: 'size-12 rounded-control textSubtitle',
};

/**
 * FNV-1a over UTF-16 code units, then a 32-bit finalizer so ids that differ
 * only in their last characters still spread across paints.
 */
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/** The paint `seed` picks (stable across runs and devices). */
export function monogramPaint(seed: string): MonogramPaint {
  return MONOGRAM_PAINTS[hashSeed(seed) % MONOGRAM_PAINTS.length] ?? 'player1';
}

/** Whole user-perceived characters, so an emoji or accent stays whole. */
const GRAPHEMES = new Intl.Segmenter('en', { granularity: 'grapheme' });

/**
 * The first letter or digit of `name`, upper-cased; the first character when
 * it has none (an emoji name keeps its emoji); `?` when it is empty.
 */
export function monogramOf(name: string): string {
  const characters = Array.from(
    GRAPHEMES.segment(name.trim()),
    (part) => part.segment
  );
  const letter = characters.find((c) => /^[\p{L}\p{N}]/u.test(c));
  return (letter ?? characters[0] ?? '?').toLocaleUpperCase('en');
}

export type MonogramTileProps = {
  /** What the tile stands for; its first letter is drawn. */
  name: string;
  /** Picks the paint: the same seed (an id) always gets the same one. */
  seed: string;
  /** Defaults to `md`. */
  size?: MonogramTileSize | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `MonogramTile` -- a thing's own mark where it has no picture: a rounded
 * square in one of the player hues, picked from a stable seed so the same
 * thing always wears the same color, carrying the first letter of its name
 * in the canvas ink (as a seat swatch carries its mark), so it reads in
 * both themes. Decorative: its name is always written beside it.
 *
 * @example
 * ```tsx
 * <MonogramTile name="Friday game night" seed={space.id} size="lg" />
 * ```
 */
export function MonogramTile(props: MonogramTileProps): JSX.Element {
  const paint = (): MonogramPaint => monogramPaint(props.seed);
  return (
    <span
      class={`box inline-flex shrink-0 items-center justify-center text text-background select-none ${SIZE[props.size ?? 'md']} ${PAINT_CLASS[paint()]}`}
      aria-hidden="true"
      {...dataAttrs({ component: 'MonogramTile', ...props.dataSet })}
      data-paint={paint()}
    >
      {monogramOf(props.name)}
    </span>
  );
}
