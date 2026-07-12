import type { LayoutRectangle } from 'react-native';

export type TooltipPlacement = 'top' | 'bottom';

export const TOOLTIP_OFFSET = 6;
export const TOOLTIP_MARGIN = 8;
export const TOOLTIP_MAX_WIDTH = 240;

export type TooltipBubbleSize = {
  width: number;
  height: number;
};

export type ViewportSize = {
  width: number;
  height: number;
};

export type ResolvedTooltipPosition = {
  top: number;
  left: number;
  placement: TooltipPlacement;
};

function verticalTop(
  anchor: LayoutRectangle,
  bubbleHeight: number,
  placement: TooltipPlacement
): number {
  if (placement === 'top') {
    return anchor.y - TOOLTIP_OFFSET - bubbleHeight;
  }
  return anchor.y + anchor.height + TOOLTIP_OFFSET;
}

function fitsVertically(
  top: number,
  bubbleHeight: number,
  viewportHeight: number
): boolean {
  return (
    top >= TOOLTIP_MARGIN &&
    top + bubbleHeight <= viewportHeight - TOOLTIP_MARGIN
  );
}

function clampHorizontal(
  centerX: number,
  bubbleWidth: number,
  viewportWidth: number
): number {
  const idealLeft = centerX - bubbleWidth / 2;
  const maxLeft = viewportWidth - TOOLTIP_MARGIN - bubbleWidth;
  return Math.max(TOOLTIP_MARGIN, Math.min(idealLeft, maxLeft));
}

function pickVerticalPlacement(
  anchor: LayoutRectangle,
  bubbleHeight: number,
  viewportHeight: number,
  preferred: TooltipPlacement
): TooltipPlacement {
  const preferredTop = verticalTop(anchor, bubbleHeight, preferred);
  if (fitsVertically(preferredTop, bubbleHeight, viewportHeight)) {
    return preferred;
  }

  const flipped: TooltipPlacement = preferred === 'top' ? 'bottom' : 'top';
  const flippedTop = verticalTop(anchor, bubbleHeight, flipped);
  if (fitsVertically(flippedTop, bubbleHeight, viewportHeight)) {
    return flipped;
  }

  const spaceAbove = anchor.y - TOOLTIP_MARGIN;
  const spaceBelow =
    viewportHeight - TOOLTIP_MARGIN - (anchor.y + anchor.height);
  return spaceAbove >= spaceBelow ? 'top' : 'bottom';
}

function clampVertical(
  top: number,
  bubbleHeight: number,
  viewportHeight: number
): number {
  const maxTop = viewportHeight - TOOLTIP_MARGIN - bubbleHeight;
  return Math.max(TOOLTIP_MARGIN, Math.min(top, maxTop));
}

export function resolveTooltipPosition(
  anchor: LayoutRectangle,
  bubble: TooltipBubbleSize,
  viewport: ViewportSize,
  preferred: TooltipPlacement
): ResolvedTooltipPosition {
  const centerX = anchor.x + anchor.width / 2;
  const placement = pickVerticalPlacement(
    anchor,
    bubble.height,
    viewport.height,
    preferred
  );
  const top = clampVertical(
    verticalTop(anchor, bubble.height, placement),
    bubble.height,
    viewport.height
  );
  const left = clampHorizontal(centerX, bubble.width, viewport.width);

  return { top, left, placement };
}
