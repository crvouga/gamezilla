/**
 * Overlay z-index scale for app-root portal hosts.
 *
 * Surfaces sit below banners and pointer overlays so drag previews / toasts
 * still float above modals.
 *
 * | Layer              | zIndex      |
 * | ------------------ | ----------- |
 * | Surface stack base | 10_000 + n  |
 * | Banner portal      | 999_999     |
 * | Overlay portal     | 1_000_000   |
 * | Tooltip bubble     | 1_000_001   |
 */

/** First open surface’s z-index. */
export const SURFACE_STACK_BASE = 10_000;

/** Gap between successive surface layers. */
export const SURFACE_STACK_STEP = 10;
