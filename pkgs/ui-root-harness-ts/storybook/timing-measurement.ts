/** Compare browser durations in integer microseconds, not binary millisecond fractions. */
export function timingMicroseconds(milliseconds: number): number {
  return Math.round(milliseconds * 1000);
}
