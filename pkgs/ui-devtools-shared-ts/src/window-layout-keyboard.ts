/**
 * What a key does to a window layout. Every pointer gesture has a key here:
 * the keyboard is a full way to arrange windows, not a fallback.
 *
 * On a tab:
 * - Left / Right / Home / End show another tab of the window.
 * - Shift + Left / Right reorder the tab.
 * - Alt + arrow goes to the window on that side.
 * - Alt + Shift + arrow moves the panel to the window on that side, or to a
 *   new window there when the layout ends on that side.
 *
 * On a divider: arrows resize by a step (Shift for a large one), Home / End
 * go to the limits, Enter evens the split.
 */

import {
  type WindowEdge,
  type WindowGroup,
  type WindowLayout,
  type WindowLayoutCommand,
  type WindowSplitDirection,
  windowById,
  windowOfPanel,
} from './window-layout';
import { windowNeighbor } from './window-layout-geometry';

export type WindowKey = {
  readonly key: string;
  readonly altKey?: boolean | undefined;
  readonly shiftKey?: boolean | undefined;
};

const ARROW_EDGE: Readonly<Record<string, WindowEdge>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'top',
  ArrowDown: 'bottom',
};

/** `aria-keyshortcuts` of a tab. */
export const WINDOW_TAB_KEYSHORTCUTS =
  'ArrowLeft ArrowRight Home End Shift+ArrowLeft Shift+ArrowRight Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown Alt+Shift+ArrowLeft Alt+Shift+ArrowRight Alt+Shift+ArrowUp Alt+Shift+ArrowDown Delete';

/** `aria-keyshortcuts` of a divider. */
export const WINDOW_SEPARATOR_KEYSHORTCUTS =
  'ArrowLeft ArrowRight ArrowUp ArrowDown Home End Enter';

function acrossWindows(
  layout: WindowLayout,
  at: { readonly group: WindowGroup; readonly panel: string },
  key: WindowKey
): WindowLayoutCommand | null {
  const edge = ARROW_EDGE[key.key];
  if (edge === undefined) return null;
  const neighbor = windowNeighbor(layout, at.group.id, edge);
  if (key.shiftKey !== true) {
    const next = windowById(layout, neighbor);
    return next === null ? null : { type: 'select', panel: next.active };
  }
  if (neighbor !== null)
    return { type: 'move', panel: at.panel, window: neighbor };
  if (at.group.tabs.length === 1) return null;
  return { type: 'split', panel: at.panel, window: at.group.id, edge };
}

function withinWindow(
  group: WindowGroup,
  panel: string,
  key: WindowKey
): WindowLayoutCommand | null {
  const at = group.tabs.indexOf(panel);
  const count = group.tabs.length;
  const step = { ArrowLeft: -1, ArrowRight: 1 }[key.key];
  if (key.shiftKey === true) {
    if (step === undefined) return null;
    const index = at + step;
    if (index < 0 || index >= count) return null;
    return { type: 'move', panel, window: group.id, index };
  }
  const target = {
    Home: 0,
    End: count - 1,
    ArrowLeft: (at - 1 + count) % count,
    ArrowRight: (at + 1) % count,
  }[key.key];
  const next = target === undefined ? undefined : group.tabs[target];
  return next === undefined || next === panel
    ? null
    : { type: 'select', panel: next };
}

/** The command a key pressed on `panel`'s tab makes, or `null` for none. */
export function windowTabKeyCommand(
  layout: WindowLayout,
  panel: string,
  key: WindowKey
): WindowLayoutCommand | null {
  const group = windowOfPanel(layout, panel);
  if (group === null) return null;
  return key.altKey === true
    ? acrossWindows(layout, { group, panel }, key)
    : withinWindow(group, panel, key);
}

/** One arrow press moves a divider this share of its split. */
export const WINDOW_RESIZE_STEP = 0.02;
export const WINDOW_RESIZE_LARGE_STEP = 0.1;

/** The command a key pressed on a divider makes, or `null` for none. */
export function windowSeparatorKeyCommand(
  separator: {
    readonly split: string;
    readonly index: number;
    readonly direction: WindowSplitDirection;
  },
  key: WindowKey
): WindowLayoutCommand | null {
  const { split, index } = separator;
  if (key.key === 'Enter') return { type: 'equalize', split };
  const step =
    key.shiftKey === true ? WINDOW_RESIZE_LARGE_STEP : WINDOW_RESIZE_STEP;
  const along: Readonly<Record<string, number>> =
    separator.direction === 'row'
      ? { ArrowLeft: -step, ArrowRight: step }
      : { ArrowUp: -step, ArrowDown: step };
  const delta = { Home: -1, End: 1, ...along }[key.key];
  return delta === undefined ? null : { type: 'resize', split, index, delta };
}

/**
 * The command a key makes on a tab of a single tab bar that lists every
 * panel (a narrow screen): the arrows walk all panels, in reading order.
 */
export function windowFlatTabKeyCommand(
  panels: readonly string[],
  panel: string,
  key: WindowKey
): WindowLayoutCommand | null {
  const at = panels.indexOf(panel);
  const count = panels.length;
  if (at === -1) return null;
  const target = {
    Home: 0,
    End: count - 1,
    ArrowLeft: (at - 1 + count) % count,
    ArrowRight: (at + 1) % count,
  }[key.key];
  const next = target === undefined ? undefined : panels[target];
  return next === undefined || next === panel
    ? null
    : { type: 'select', panel: next };
}
