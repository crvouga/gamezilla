import type { ReactNode } from 'react';

export type StatusBarItemId = string;

/**
 * A slot registered into the global status bar. Features own their indicator
 * and Control Center tile face; the bar only composes and sorts them.
 */
export type StatusBarItem = {
  id: StatusBarItemId;
  /**
   * Ascending sort in the thin bar (lower = further left / leading).
   * Defaults to `100`.
   */
  order?: number;
  /** Compact glyph shown in the thin strip. */
  indicator: ReactNode;
  /** Accessibility label for the indicator cluster entry. */
  accessibilityLabel?: string;
  /** Stable `testID` for strip indicator + Control Center tile pressables. */
  testID?: string;
  /** Primary label on the Control Center tile. */
  title: ReactNode;
  /** Optional supporting line under the title. */
  caption?: ReactNode;
  /** Icon / avatar shown on the tile face. */
  leading?: ReactNode;
  /** Tap handler for the tile (toggle, refresh, navigate, …). */
  onPress?: () => void;
  /** When `true`, tile uses filled/accent treatment (toggle on). */
  active?: boolean;
  /** When `false`, hidden from both the strip and the expanded surface. */
  visible?: boolean;
};

export type RegisteredStatusBarItem = StatusBarItem & {
  /** Internal stamp; registry ownership uses `registrationId`. */
  _version: number;
};

export function isStatusBarItemVisible(item: StatusBarItem): boolean {
  return item.visible !== false;
}

export function statusBarItemOrder(item: StatusBarItem): number {
  return item.order ?? 100;
}

export function compareStatusBarItems(
  a: StatusBarItem,
  b: StatusBarItem
): number {
  const orderDelta = statusBarItemOrder(a) - statusBarItemOrder(b);
  if (orderDelta !== 0) return orderDelta;
  return a.id.localeCompare(b.id);
}
