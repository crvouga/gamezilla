export function canonicalUserPair(
  a: string,
  b: string
): { readonly userLow: string; readonly userHigh: string } {
  return a < b ? { userLow: a, userHigh: b } : { userLow: b, userHigh: a };
}

export function otherUserInPair(
  userLow: string,
  userHigh: string,
  viewerId: string
): string | null {
  if (viewerId === userLow) return userHigh;
  if (viewerId === userHigh) return userLow;
  return null;
}
