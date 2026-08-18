/** Canonical unordered pair for friendship lookups (same as friends package). */
export function canonicalUserPair(
  a: string,
  b: string
): { readonly userLow: string; readonly userHigh: string } {
  return a < b ? { userLow: a, userHigh: b } : { userLow: b, userHigh: a };
}
