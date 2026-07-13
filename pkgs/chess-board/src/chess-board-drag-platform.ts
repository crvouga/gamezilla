/**
 * Portal drag overlay is active whenever the prop is on.
 *
 * Web: Skia `Canvas` in the overlay portal (piece can float above modals).
 * Native: Reanimated + SvgXml portal — a second full-screen Skia `Canvas`
 * crashes iOS on pickup, and RN Image data-URIs often fail to decode.
 */
export function isDragOverlayPortalActive(dragOverlayPortal: boolean): boolean {
  return dragOverlayPortal;
}
