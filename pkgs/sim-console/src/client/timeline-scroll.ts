export type ItemLayout = {
  readonly x: number;
  readonly width: number;
};

/** Target scroll offset so `layout` is fully visible, or null if already in view. */
export function scrollOffsetToReveal(args: {
  readonly layout: ItemLayout | undefined;
  readonly viewportWidth: number;
  readonly scrollX: number;
  readonly pad?: number;
}): number | null {
  const pad = args.pad ?? 8;
  const layout = args.layout;
  if (layout === undefined || args.viewportWidth <= 0) return null;
  const left = layout.x;
  const right = layout.x + layout.width;
  if (left < args.scrollX + pad) return Math.max(0, left - pad);
  if (right > args.scrollX + args.viewportWidth - pad) {
    return Math.max(0, right - args.viewportWidth + pad);
  }
  return null;
}
