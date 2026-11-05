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
 * The paints a tile may take: six tile colours that are the same in both
 * schemes (so a space keeps its colour when the theme changes), each
 * holding AA with white ink, and none of them the indigo of what is chosen.
 */
export const MONOGRAM_PAINTS = [
  'monogram1',
  'monogram2',
  'monogram3',
  'monogram4',
  'monogram5',
  'monogram6',
] as const;

export type MonogramPaint = (typeof MONOGRAM_PAINTS)[number];

const PAINT_CLASS: Readonly<Record<MonogramPaint, string>> = {
  monogram1: 'bg-monogram1',
  monogram2: 'bg-monogram2',
  monogram3: 'bg-monogram3',
  monogram4: 'bg-monogram4',
  monogram5: 'bg-monogram5',
  monogram6: 'bg-monogram6',
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
  return (
    MONOGRAM_PAINTS[hashSeed(seed) % MONOGRAM_PAINTS.length] ?? 'monogram1'
  );
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
 * square in one of six tile colours, picked from a stable seed so the same
 * thing always wears the same colour in both themes, carrying the first
 * letter of its name in white. Decorative: its name is always written beside it.
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
      class={`box inline-flex shrink-0 items-center justify-center text text-on-primary select-none ${SIZE[props.size ?? 'md']} ${PAINT_CLASS[paint()]}`}
      aria-hidden="true"
      {...dataAttrs({ component: 'MonogramTile', ...props.dataSet })}
      data-paint={paint()}
    >
      {monogramOf(props.name)}
    </span>
  );
}
