/**
 * Roving-focus math for composite widgets that keep one tab stop and move
 * focus with the arrow keys (WAI-ARIA tabs, radio group, toolbar).
 * Arrows wrap and skip disabled items; Home / End jump to the first and last
 * enabled item when the pattern asks for them. Framework-free.
 */

/** Which arrow keys move focus. `both` answers all four. */
export type RovingOrientation = 'horizontal' | 'vertical' | 'both';

export type RovingKeyArgs = {
  readonly key: string;
  /** Index of the focused item, or `-1` when focus is elsewhere. */
  readonly current: number;
  /** One entry per item, in order: `true` skips it. */
  readonly disabled: readonly boolean[];
  readonly orientation: RovingOrientation;
  /** Answer Home and End. Default `true`. */
  readonly homeEnd?: boolean | undefined;
};

const FORWARD: Readonly<Record<RovingOrientation, readonly string[]>> = {
  horizontal: ['ArrowRight'],
  vertical: ['ArrowDown'],
  both: ['ArrowRight', 'ArrowDown'],
};

const BACKWARD: Readonly<Record<RovingOrientation, readonly string[]>> = {
  horizontal: ['ArrowLeft'],
  vertical: ['ArrowUp'],
  both: ['ArrowLeft', 'ArrowUp'],
};

/** The next enabled index stepping `step` from `from`, wrapping; `null` if none. */
function stepEnabled(
  disabled: readonly boolean[],
  from: number,
  step: 1 | -1
): number | null {
  const count = disabled.length;
  for (let offset = 1; offset <= count; offset++) {
    const index = (((from + step * offset) % count) + count) % count;
    if (disabled[index] !== true) return index;
  }
  return null;
}

/** First enabled index, or `null` when every item is disabled. */
export function firstEnabledIndex(disabled: readonly boolean[]): number | null {
  const index = disabled.findIndex((off) => !off);
  return index < 0 ? null : index;
}

/** Last enabled index, or `null` when every item is disabled. */
export function lastEnabledIndex(disabled: readonly boolean[]): number | null {
  for (let index = disabled.length - 1; index >= 0; index--) {
    if (disabled[index] !== true) return index;
  }
  return null;
}

/** Index to focus after `key`, or `null` when the key is not handled. */
export function nextRovingIndex(args: RovingKeyArgs): number | null {
  const { key, current, disabled, orientation } = args;
  if (disabled.length === 0) return null;
  const homeEnd = args.homeEnd ?? true;
  if (homeEnd && key === 'Home') return firstEnabledIndex(disabled);
  if (homeEnd && key === 'End') return lastEnabledIndex(disabled);
  if (FORWARD[orientation].includes(key)) {
    return stepEnabled(disabled, current < 0 ? -1 : current, 1);
  }
  if (BACKWARD[orientation].includes(key)) {
    return stepEnabled(disabled, current < 0 ? 0 : current, -1);
  }
  return null;
}

/**
 * The one item in the tab order: the selected item when it is enabled,
 * otherwise the first enabled item.
 */
export function rovingTabStop(
  selected: number,
  disabled: readonly boolean[]
): number | null {
  if (selected >= 0 && disabled[selected] !== true) return selected;
  return firstEnabledIndex(disabled);
}
