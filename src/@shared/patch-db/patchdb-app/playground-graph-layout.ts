export const PLAYGROUND_GRAPH_VIEW_W = 560;
export const PLAYGROUND_GRAPH_VIEW_H = 220;

export const playgroundGraphServerAnchor = { x: 280, y: 52 } as const;

export function playgroundGraphClientAnchors(
  count: number
): { x: number; y: number }[] {
  const vw = PLAYGROUND_GRAPH_VIEW_W;
  const cy = 170;
  if (count <= 0) return [];
  if (count === 1) return [{ x: vw / 2, y: cy }];
  const maxSpread = vw * 0.82;
  const spread = Math.min(maxSpread, 80 + count * 64);
  const left = vw / 2 - spread / 2;
  const step = count > 1 ? spread / (count - 1) : 0;
  return Array.from({ length: count }, (_, i) => ({
    x: left + i * step,
    y: cy,
  }));
}
