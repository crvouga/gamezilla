/**
 * Responsive prop values. A layout prop takes one token, or one token per
 * breakpoint, mobile first: `base` applies from zero width, and each
 * `BreakpointToken` from its minimum width up.
 *
 * ```tsx
 * <Stack direction={{ base: 'vertical', md: 'horizontal' }} gap={{ base: 'sm', lg: 'xl' }} />
 * ```
 *
 * Breakpoint tokens are the only widths a screen may branch on; there is no
 * media-query prop. Each responsive prop resolves through a literal class
 * table ({@link responsiveTable}), so the stylesheet scanner sees every
 * class it can emit.
 */

import type { BreakpointToken } from '@pkgs/ui-root-shared-ts/token-names';
import { BREAKPOINT_TOKENS } from '@pkgs/ui-root-shared-ts/token-names';

export type Responsive<T> =
  | T
  | {
      readonly base?: T | undefined;
      readonly sm?: T | undefined;
      readonly md?: T | undefined;
      readonly lg?: T | undefined;
      readonly xl?: T | undefined;
    };

type Slot = 'base' | BreakpointToken;

const SLOTS: readonly Slot[] = ['base', ...BREAKPOINT_TOKENS];

/** The class of each slot for one value, in {@link SLOTS} order. */
export type ResponsiveTable<T extends string | number> = Readonly<
  Record<T, readonly string[]>
>;

/**
 * A class table from one row per value. A row lists the value's class at
 * `base`, `sm`, `md`, `lg` and `xl`, space-separated and written out in full.
 */
export function responsiveTable<T extends string | number>(
  rows: Readonly<Record<T, string>>
): ResponsiveTable<T> {
  const table: Record<string, readonly string[]> = {};
  for (const [value, row] of Object.entries<string>(rows)) {
    const classes = row.split(' ');
    if (classes.length !== SLOTS.length) {
      throw new Error(
        `responsive row for ${value} needs ${SLOTS.length} classes`
      );
    }
    table[value] = classes;
  }
  return table as ResponsiveTable<T>;
}

/** Classes for `value` from `table`; empty when the prop is unset. */
export function responsiveClass<T extends string | number>(
  table: ResponsiveTable<T>,
  value: Responsive<T> | undefined
): string {
  if (value === undefined) return '';
  if (typeof value !== 'object') return table[value][0] ?? '';
  const classes: string[] = [];
  SLOTS.forEach((slot, index) => {
    const at = value[slot];
    if (at !== undefined) classes.push(table[at][index] ?? '');
  });
  return classes.join(' ');
}
