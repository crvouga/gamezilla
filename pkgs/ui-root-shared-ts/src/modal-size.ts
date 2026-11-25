/**
 * Fixed modal width buckets. {@link resolveModalLayoutWidth} clamps to the
 * layout width so modals never overflow horizontally.
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

/**
 * Extra room one side of an inset modal (a confirmation) keeps inside the
 * edge margin, so stacked over a full-width surface it stands visibly inside
 * it, its edges clear of the one below. Other modals take the whole room.
 */
export const SMALL_MODAL_INSET_PX = 20;

function availableWidth(layoutWidth: number, marginPx: number): number {
  const gutter = marginPx * 2;
  return Math.max(0, layoutWidth - gutter);
}

/**
 * Resolved content width in px for a modal bucket at the given layout width.
 * `marginPx` is one side (e.g. `spacing[MODAL_CONTENT_MARGIN_STEP]`).
 * `inset` (confirmations only) keeps {@link SMALL_MODAL_INSET_PX} further in.
 */
export function resolveModalLayoutWidth(
  size: ModalSize,
  layoutWidth: number,
  marginPx: number,
  inset = false
): number {
  const available = availableWidth(layoutWidth, marginPx);
  if (size === 'fullWidth') {
    return Math.max(MIN_MODAL_WIDTH_PX, available);
  }
  const bucket = MODAL_WIDTH_PX[size];
  const room = inset ? available - SMALL_MODAL_INSET_PX * 2 : available;
  const clamped = Math.min(bucket, room);
  return Math.max(MIN_MODAL_WIDTH_PX, clamped);
}

/**
 * Max modal body height in px for the given layout height and edge margin.
 * Keeps centered modals inset equally from the top and bottom.
 */
export function resolveModalLayoutMaxHeight(
  layoutHeight: number,
  marginPx: number
): number {
  const gutter = marginPx * 2;
  return Math.max(MIN_MODAL_WIDTH_PX, layoutHeight - gutter);
}
