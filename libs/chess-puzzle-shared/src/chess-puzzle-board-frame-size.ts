function squareFitSize(
  width: number,
  height: number,
  reserveTop: number
): number {
  return Math.floor(Math.min(width, Math.max(0, height - reserveTop)));
}

/**
 * Prefer filling the island width on wide hosts when height allows a near-full
 * square; never exceed the host box.
 */
export function boardFrameSize(
  width: number,
  height: number,
  reserveTop: number
): number {
  return squareFitSize(width, height, reserveTop);
}

export { squareFitSize };
