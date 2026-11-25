/**
 * How a {@link ResponsiveSurface} presents. Every overlay is a modal
 * centered on the screen, vertically and horizontally, at every width --
 * phone included. Nothing docks to the bottom edge.
 *
 * - `'responsive'` (default) -- the centered modal; on compact layouts it
 *   takes the whole width inside the 16px backdrop margin. Pickers, filters,
 *   menus, detail panels.
 * - `'modal'` -- the same centered modal. Kept so confirms and decisions
 *   (`ConfirmationModal`, `MutationModal`) can say they are dialogs.
 *
 * Both sit on the same scrim, trap focus, return it to the opener on close,
 * close on Escape or a scrim tap, and scroll long content inside the modal.
 */
export type ResponsiveSurfacePresentation = 'responsive' | 'modal';
