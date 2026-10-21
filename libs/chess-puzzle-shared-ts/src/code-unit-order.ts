/**
 * Locale-independent string order (UTF-16 code units), so stored themes and
 * opening tags sort alike on every device and server.
 */
export function compareCodeUnit(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
