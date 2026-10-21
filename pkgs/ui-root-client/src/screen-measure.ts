/**
 * The measure a screen's column is capped at, one per template family:
 *
 * - `menu` (480px): menus, settings, forms, profiles, game menus and
 *   history / stats — rows and fields read best at a phone's width.
 * - `prose` (640px, the prose token): readable details and documents.
 * - `full`: the whole frame column — collections, explorers and game stages
 *   with a side rail.
 *
 * On wide layouts a capped column is centered in the frame, and the page's
 * title block sits in the same column so the title lines up with the
 * content. Compact layouts keep every column on the 16px page edge.
 */

import type { Accessor } from 'solid-js';
import { useLayoutMode } from './use-layout-mode';

export type ScreenMeasure = 'menu' | 'prose' | 'full';

export const SCREEN_MAX_WIDTH: Readonly<Record<ScreenMeasure, string>> = {
  menu: '480px',
  prose: '640px',
  full: '100%',
};

/** Whether a capped column centers here: on wide layouts only. */
export function useScreenMeasureCentered(): Accessor<boolean> {
  const mode = useLayoutMode();
  return () => mode() === 'wide';
}
