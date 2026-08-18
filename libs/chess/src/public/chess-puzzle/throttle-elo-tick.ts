/** Returns true when enough time elapsed to play another ELO tick sound. */
export function shouldPlayEloTick(args: {
  nextRating: number;
  prevDisplayedRating: number;
  lastTickAtMs: number;
  nowMs: number;
  minIntervalMs?: number;
}): boolean {
  const {
    nextRating,
    prevDisplayedRating,
    lastTickAtMs,
    nowMs,
    minIntervalMs = 80,
  } = args;
  if (nextRating === prevDisplayedRating) return false;
  return nowMs - lastTickAtMs >= minIntervalMs;
}
