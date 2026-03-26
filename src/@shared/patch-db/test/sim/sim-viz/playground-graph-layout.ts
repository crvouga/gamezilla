/** Shared with SVG viewBox and HTML overlay positioning (fractions of view size). */
export const PLAYGROUND_GRAPH_VIEW_W = 480;
export const PLAYGROUND_GRAPH_VIEW_H = 280;

export const playgroundGraphServerAnchor = { x: 240, y: 62 } as const;

export function playgroundGraphClientAnchors(count: number): { x: number; y: number }[] {
  const vw = PLAYGROUND_GRAPH_VIEW_W;
  const vh = PLAYGROUND_GRAPH_VIEW_H;
  const cx = vw / 2;
  const rowY = vh * 0.72;
  if (count <= 0) return [];
  if (count === 1) return [{ x: cx, y: rowY }];
  const maxSpread = vw * 0.72;
  const spread = Math.min(maxSpread, 56 + count * 48);
  const left = cx - spread / 2;
  const step = count > 1 ? spread / (count - 1) : 0;
  return Array.from({ length: count }, (_, i) => ({
    x: left + i * step,
    y: rowY,
  }));
}
