/**
 * Stories render with reduced motion so screenshots are stable. A capture
 * that measures real motion sets the `motion` global to `system`, and the
 * browser's `prefers-reduced-motion` (or `page.emulateMedia`) then decides.
 */
export function storyReducedMotion(globals: Record<string, unknown>): boolean {
  return globals['motion'] !== 'system';
}
