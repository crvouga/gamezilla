import type { SimulationFrameDatabase } from '../types';

export const TIMELINE_ZOOM_MIN = 0.25;
export const TIMELINE_ZOOM_MAX = 8;
export const TIMELINE_BASE_PX_PER_MS = 0.04;
export const TIMELINE_SEG_GAP_PX = 2;

/** Clamp zoom after a multiplicative delta (e.g. wheel/pinch). */
export function zoomAbout(args: {
  readonly zoom: number;
  readonly delta: number;
  readonly min?: number;
  readonly max?: number;
}): number {
  const min = args.min ?? TIMELINE_ZOOM_MIN;
  const max = args.max ?? TIMELINE_ZOOM_MAX;
  const next = args.zoom * args.delta;
  if (next < min) return min;
  if (next > max) return max;
  return next;
}

/**
 * Duration-weighted segment widths. Always fills `trackWidth` when content
 * would otherwise be narrower; zoom can grow past fill (caller scrolls).
 */
export function computeSegmentWidths(args: {
  readonly durations: readonly number[];
  readonly trackWidth: number;
  readonly zoom: number;
  readonly basePxPerMs?: number;
  readonly gapPx?: number;
}): number[] {
  const {
    durations,
    trackWidth,
    zoom,
    basePxPerMs = TIMELINE_BASE_PX_PER_MS,
    gapPx = TIMELINE_SEG_GAP_PX,
  } = args;
  const n = durations.length;
  if (n === 0) return [];
  const available = Math.max(0, trackWidth - gapPx * Math.max(0, n - 1));
  const raw = durations.map((ms) => Math.max(ms, 1) * basePxPerMs * zoom);
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0 || available <= 0) {
    const even = available / n;
    return raw.map(() => even);
  }
  const scale = sum < available ? available / sum : 1;
  return raw.map((w) => w * scale);
}

/** True when any node sha differs / appears / disappears vs previous frame. */
export function frameDatabasesChanged(
  prev: readonly SimulationFrameDatabase[] | undefined,
  next: readonly SimulationFrameDatabase[] | undefined
): { readonly changed: boolean; readonly changedCount: number } {
  const prevMap = new Map<string, string>();
  for (const d of prev ?? []) prevMap.set(d.nodeId, d.sha256);
  const nextMap = new Map<string, string>();
  for (const d of next ?? []) nextMap.set(d.nodeId, d.sha256);

  let changedCount = 0;
  for (const [id, sha] of nextMap) {
    if (prevMap.get(id) !== sha) changedCount += 1;
  }
  for (const id of prevMap.keys()) {
    if (!nextMap.has(id)) changedCount += 1;
  }
  return { changed: changedCount > 0, changedCount };
}
