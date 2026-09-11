// @io-wall-ok
/**
 * Wall `requestAnimationFrame` adapters for the chess-board drag loop.
 * Inject {@link wallScheduleFrame} / {@link wallCancelFrame} at composition
 * roots or tests; product code must not call rAF bare.
 */

export function wallScheduleFrame(cb: FrameRequestCallback): number {
  return requestAnimationFrame(cb);
}

export function wallCancelFrame(id: number): void {
  cancelAnimationFrame(id);
}
