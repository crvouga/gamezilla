import { Platform } from 'react-native';

/**
 * Portal drag overlay is web-only. On iOS/Android the dragged piece renders
 * inside the board Skia canvas (`InlineDragLayer`) — mounting a second
 * full-screen Skia `Canvas` in the overlay portal crashes iOS on pickup.
 */
export function isDragOverlayPortalActive(dragOverlayPortal: boolean): boolean {
  return dragOverlayPortal && Platform.OS === 'web';
}
