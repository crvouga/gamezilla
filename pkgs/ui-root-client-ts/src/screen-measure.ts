/**
 * The measure a screen's column is capped at, one per template family:
 *
 * - `menu` (480px): menus, settings, forms, profiles, game menus and
 *   history / stats — rows and fields read best at a phone's width.
 * - `prose` (640px, the prose token): readable details and documents.
 * - `list` (720px): collections — spaces, people, search results, the inbox.
 *   Rows keep a scannable line length instead of stretching across a monitor.
 * - `full`: the whole frame column — explorers and game stages with a side
 *   rail.
 *
 * A capped column is centered in the frame at every width, and the page's
 * title block sits in the same column so the title lines up with the
 * content. Narrow layouts retain the 16px page inset.
 */

export type ScreenMeasure = 'menu' | 'prose' | 'list' | 'full';

export const SCREEN_MAX_WIDTH: Readonly<Record<ScreenMeasure, string>> = {
  menu: '480px',
  prose: '640px',
  list: '720px',
  full: '100%',
};
