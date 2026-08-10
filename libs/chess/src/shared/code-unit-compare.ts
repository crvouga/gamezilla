/** Locale-independent string compare (UTF-16 code units). Safe for ISO-8601. */
export function compareCodeUnit(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
