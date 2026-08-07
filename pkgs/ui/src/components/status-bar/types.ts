import type { ReactNode } from 'react';

export type StatusBarItemId = string;

/**
 * A slot registered into the global status bar. Features own their indicator
 * and expanded panel UI; the bar only composes and sorts them.
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
  /** Section heading in the expanded surface. */
  title: ReactNode;
  /** Optional supporting line under the title. */
  caption?: ReactNode;
  /** Optional leading icon / avatar in the expanded section header. */
  leading?: ReactNode;
  /** Controls and details shown under the section heading. */
  panel: ReactNode;
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
