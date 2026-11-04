/**
 * The measure a screen's column is capped at on compact hosts (phones and
 * tablets), where a capped column is centered. Every family shares 720px, so
 * moving between screens never makes the column jump; the names say which
 * template family a screen belongs to:
 *
 * - `menu`: menus, settings, forms, profiles, game menus, history / stats.
 * - `prose`: readable details and documents.
 * - `list`: collections — spaces, people, search results, the inbox.
 * - `full`: the whole frame column — explorers and game stages with a side
 *   rail.
 *
 * On desktop every screen starts at the frame column's leading edge and
 * `menu` / `list` take the whole column, composing it instead (sections
 * put their label beside their rows; collections add a context column);
 * only `prose` keeps its reading measure. See `useScreenMeasure`.
 */

export type ScreenMeasure = 'menu' | 'prose' | 'list' | 'full';

export const SCREEN_MAX_WIDTH: Readonly<Record<ScreenMeasure, string>> = {
  menu: '720px',
  prose: '720px',
  list: '720px',
  full: '100%',
};
