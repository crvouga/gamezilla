/** Minimum distance from the host viewport edges. */
export const TOOLTIP_EDGE_MARGIN = 8;

export type TooltipShiftInput = {
  /** Anchor left edge in the same coordinate space as `viewportWidth`. */
  anchorX: number;
  anchorWidth: number;
  bubbleWidth: number;
  viewportWidth: number;
  edgeMargin?: number | undefined;
};

/**
 * Extra `translateX` (px) so a bubble centered on the anchor stays inside the
 * viewport. Positive shifts right; negative shifts left.
 */
export function computeTooltipShiftX(input: TooltipShiftInput): number {
  const margin = input.edgeMargin ?? TOOLTIP_EDGE_MARGIN;
  if (input.viewportWidth <= 0 || input.bubbleWidth <= 0) return 0;

  const centerX = input.anchorX + input.anchorWidth / 2;
  const naturalLeft = centerX - input.bubbleWidth / 2;
  const minLeft = margin;
  const maxLeft = input.viewportWidth - input.bubbleWidth - margin;
  const clampedLeft =
    maxLeft < minLeft
      ? minLeft
      : Math.max(minLeft, Math.min(naturalLeft, maxLeft));
  return clampedLeft - naturalLeft;
}
