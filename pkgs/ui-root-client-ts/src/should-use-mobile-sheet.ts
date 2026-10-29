import type { LayoutMode } from './use-layout-mode';

/**
 * How a {@link ResponsiveSurface} presents. The design system's Sheet and
 * Dialog are this one surface:
 *
 * - `'responsive'` (default) -- the **Sheet**: a bottom sheet on compact
 *   layouts (raised fill, 20px top radius, grab handle, safe-area inset),
 *   the centered dialog on wide ones. Pickers, filters, detail panels.
 * - `'modal'` -- the **Dialog**: always the centered dialog, at every width.
 *   Confirms and decisions that should never read as a sheet
 *   (`ConfirmationModal`, `MutationModal`).
 *
 * Both sit on the same scrim, trap focus, return it to the opener on close,
 * and close on Escape or a scrim tap.
 */
export type ResponsiveSurfacePresentation = 'responsive' | 'modal';

/**
 * Whether {@link ResponsiveSurface} should take the bottom-sheet path.
 * Passthrough hosts (`supportsSheetPresentation: false`) always use the
 * centered modal / surface-stack path so overlays cover nested panel roots.
 */
export function shouldUseMobileSheet(opts: {
  presentation: ResponsiveSurfacePresentation | undefined;
  layoutMode: LayoutMode;
  supportsSheetPresentation: boolean | undefined;
}): boolean {
  if (opts.presentation === 'modal') return false;
  if (opts.layoutMode !== 'compact') return false;
  if (opts.supportsSheetPresentation === false) return false;
  return true;
}
