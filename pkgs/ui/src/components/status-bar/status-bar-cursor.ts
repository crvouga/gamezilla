/**
 * Web mouse cursors for status-bar pan handles. Native ignores `cursor`.
 */

import type { SxProps } from '../../theme';

/** `grab` at rest; `grabbing` while a pan gesture is active. */
export function statusBarGrabCursor(grabbing: boolean): SxProps {
  return {
    cursor: grabbing ? 'grabbing' : 'grab',
  };
}
