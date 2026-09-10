/** Format a CSS length — numbers become `Npx`, strings pass through. */
export function cssPx(value: number | string): string {
  if (typeof value === 'number') return value === 0 ? '0' : `${value}px`;
  return value;
}

/** Format a numeric spacing step as a CSS gap value (`step * 4px`). */
export function cssGap(step: number): string {
  return cssPx(step * 4);
}
