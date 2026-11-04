import type { Accessor } from 'solid-js';
import { useAppFrameHeaderOverridden } from './app-frame-chrome/index';
import { useLayoutMode } from './use-layout-mode';

/**
 * Whether a capped screen measure centers in the space it has.
 *
 * Reading screens (tabs, settings, lists) center their column: on a tablet
 * and on desktop beside the sidebar. Inside an open space the screen keeps
 * the leading edge its own top bar uses, so the bar and every screen under
 * it line up.
 */
export function useMeasureCentered(): Accessor<boolean> {
  const mode = useLayoutMode();
  const inSpace = useAppFrameHeaderOverridden();
  return () => mode() === 'compact' || !inSpace();
}
