import type { LayoutMode } from './use-layout-mode';

/**
 * `'responsive'` (default) -- bottom sheet on compact layouts, centered modal
 * on wide. `'modal'` -- always the centered modal (confirm flows that should
 * never be sheets).
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
