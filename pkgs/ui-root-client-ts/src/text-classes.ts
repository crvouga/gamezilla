/**
 * Class lookups for the text prop vocabulary (`tone`, `align`, `lines`,
 * `wrap`, …) shared by `Text`, the headings and the other text hosts.
 * Design-system internal.
 */

import type { ColorTone } from '@pkgs/ui-root-shared-ts/token-names';
import { spaced } from './layout-classes';

/** Inline-axis alignment; `start` follows the script direction. */
export type TextAlign = 'start' | 'center' | 'end';

/** Line clamp: the text ends in an ellipsis after this many lines. */
export type TextLines = 1 | 2 | 3 | 4 | 6;

/**
 * `normal` wraps at spaces and breaks a word only when it cannot fit,
 * `nowrap` keeps one line, `break` may break anywhere (ids, URLs, hashes).
 */
export type TextWrap = 'normal' | 'nowrap' | 'break';

/** What every text host accepts beyond its role. */
export type TextStyleProps = {
  /** Color role. Unset keeps the role's own color. */
  tone?: ColorTone | undefined;
  align?: TextAlign | undefined;
  /** Clamp to this many lines (was `line-clamp-*`). */
  lines?: TextLines | undefined;
  /** Scoreboard figures: ratings, clocks, prices, counts (was `textNumeral`). */
  numeral?: boolean | undefined;
  wrap?: TextWrap | undefined;
  /** `true` lets the text be selected, `false` forbids it. */
  selectable?: boolean | undefined;
  /**
   * Show each word with a capital first letter while the text itself keeps
   * its case (an id like `free` reads `Free`).
   */
  capitalize?: boolean | undefined;
};

const TONE: Readonly<Record<ColorTone, string>> = {
  default: 'text-text',
  secondary: 'text-text-secondary',
  tint: 'text-tint',
  destructive: 'text-destructive',
  success: 'text-success',
  warning: 'text-warning',
  info: 'text-info',
  'on-primary': 'text-on-primary',
  inherit: 'text-inherit',
};

const ALIGN: Readonly<Record<TextAlign, string>> = {
  start: 'text-start',
  center: 'text-center',
  end: 'text-end',
};

const LINES: Readonly<Record<TextLines, string>> = {
  1: 'line-clamp-1',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  6: 'line-clamp-6',
};

const WRAP: Readonly<Record<TextWrap, string>> = {
  normal: 'whitespace-pre-wrap',
  nowrap: 'whitespace-nowrap',
  break: 'break-all',
};

export function toneClass(tone: ColorTone | undefined): string {
  return tone === undefined ? '' : TONE[tone];
}

function selectClass(selectable: boolean | undefined): string | undefined {
  if (selectable === undefined) return undefined;
  return selectable ? 'select-text' : 'select-none';
}

/** Classes for the style props that are set. */
export function textStyleClass(style: TextStyleProps): string {
  return spaced([
    toneClass(style.tone),
    style.align === undefined ? undefined : ALIGN[style.align],
    style.lines === undefined ? undefined : LINES[style.lines],
    style.numeral === true ? 'textNumeral' : undefined,
    style.wrap === undefined ? undefined : WRAP[style.wrap],
    selectClass(style.selectable),
    style.capitalize === true ? 'capitalize' : undefined,
  ]);
}
