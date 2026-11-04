/**
 * The measure a screen's column is capped at. Every page column is the same
 * 640px (the prose token), so moving between tabs and screens never makes the
 * column jump; the names say which template family a screen belongs to:
 *
 * - `menu`: menus, settings, forms, profiles, game menus, history / stats.
 * - `prose`: readable details and documents.
 * - `list`: collections — spaces, people, search results, the inbox. Rows
 *   keep a scannable line length instead of stretching across a monitor.
 * - `full`: the whole frame column — explorers and game stages with a side
 *   rail.
 *
 * A capped column is centered in the frame at every width, and the page's
 * title block sits in the same column so the title lines up with the
 * content. Narrow layouts retain the 16px page inset.
 */

export type ScreenMeasure = 'menu' | 'prose' | 'list' | 'full';

export const SCREEN_MAX_WIDTH: Readonly<Record<ScreenMeasure, string>> = {
  menu: '640px',
  prose: '640px',
  list: '640px',
  full: '100%',
};
