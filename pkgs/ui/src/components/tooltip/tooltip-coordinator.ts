/**
 * Single-active-tooltip coordinator. Showing one tooltip hides whichever one
 * is currently open so keyboard focus + pointer hover never stack bubbles.
 * Framework-free; the `Tooltip` component registers its `hide` here.
 */

let activeHide: (() => void) | null = null;

export function claimActiveTooltip(hide: () => void): void {
  if (activeHide !== null && activeHide !== hide) activeHide();
  activeHide = hide;
}

export function releaseActiveTooltip(hide: () => void): void {
  if (activeHide === hide) activeHide = null;
}

/** Test-only reset so suites start from a clean coordinator. */
export function resetActiveTooltip(): void {
  activeHide = null;
}
