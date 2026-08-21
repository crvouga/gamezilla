import type { BreakpointName } from '../../theme/breakpoints';

/**
 * Whether {@link ResponsiveSurface} should take the bottom-sheet path.
 * Passthrough hosts (`supportsSheetPresentation: false`) always use the
 * centered modal / SurfaceStack path so overlays cover nested panel roots.
 */
export function shouldUseMobileSheet(opts: {
  presentation: 'responsive' | 'modal' | undefined;
  breakpoint: BreakpointName;
  supportsSheetPresentation: boolean | undefined;
}): boolean {
  if (opts.presentation === 'modal') return false;
  if (opts.breakpoint !== 'mobile') return false;
  if (opts.supportsSheetPresentation === false) return false;
  return true;
}
