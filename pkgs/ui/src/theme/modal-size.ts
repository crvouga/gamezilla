/**
 * Fixed modal width buckets. {@link resolveModalLayoutWidth} clamps to the
 * viewport so modals never overflow horizontally.
 */

export type ModalSize = 'small' | 'medium' | 'large' | 'fullWidth';

export const MODAL_WIDTH_PX: Record<Exclude<ModalSize, 'fullWidth'>, number> = {
  small: 360,
  medium: 440,
  large: 720,
};

/** Horizontal margin step on {@link ModalContent} (`m: 4` → 16px per side). */
export const MODAL_CONTENT_MARGIN_STEP = 4;

const MIN_MODAL_WIDTH_PX = 200;

function availableWidth(layoutWidth: number, marginPx: number): number {
  const gutter = marginPx * 2;
  return Math.max(0, layoutWidth - gutter);
}

/**
 * Resolved content width in px for a modal bucket at the given layout width.
 * `marginPx` is one side (e.g. `spacing[MODAL_CONTENT_MARGIN_STEP]`).
 */
export function resolveModalLayoutWidth(
  size: ModalSize,
  layoutWidth: number,
  marginPx: number
): number {
  const available = availableWidth(layoutWidth, marginPx);
  if (size === 'fullWidth') {
    return Math.max(MIN_MODAL_WIDTH_PX, available);
  }
  const bucket = MODAL_WIDTH_PX[size];
  const clamped = Math.min(bucket, available);
  return Math.max(MIN_MODAL_WIDTH_PX, clamped);
}
