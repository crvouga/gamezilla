/**
 * Web mouse cursors for status-bar pan handles. Native ignores `cursor`.
 */

import type { ViewStyle } from 'react-native';

/** `grab` at rest; `grabbing` while a pan gesture is active. */
export function statusBarGrabCursor(grabbing: boolean): ViewStyle {
  // RN's CursorValue omits grab/grabbing; RNW still applies them on web.
  return {
    cursor: grabbing ? 'grabbing' : 'grab',
  } as unknown as ViewStyle;
}
