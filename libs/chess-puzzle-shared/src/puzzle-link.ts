/**
 * A puzzle link: a stable link to one puzzle, the same each time it is
 * shared. Opening it puts that puzzle on the opener's board in their space.
 */

/** The app route a puzzle link opens. */
export const PUZZLE_LINK_ROUTE = '/chess/puzzle/:puzzleId';

/** Query parameter a space opens with to put a linked puzzle on its board. */
export const LINKED_PUZZLE_PARAM = 'puzzle';

/** The path of the puzzle link to `puzzleId`. */
export function puzzleLinkPath(puzzleId: string): string {
  return `/chess/puzzle/${encodeURIComponent(puzzleId)}`;
}

/** The puzzle link to `puzzleId` on `origin` (no origin: the path alone). */
export function puzzleLink(origin: string | null, puzzleId: string): string {
  return `${origin ?? ''}${puzzleLinkPath(puzzleId)}`;
}

/** The puzzle a puzzle link opens, or null when it is not one. */
export function puzzleIdOfLink(link: string): string | null {
  const match = /\/chess\/puzzle\/([^/?#]+)/.exec(link);
  const encoded = match?.[1];
  if (encoded === undefined) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

/** The path within a puzzle link: what a device opens. */
export function puzzleLinkPathOf(link: string): string | null {
  const puzzleId = puzzleIdOfLink(link);
  return puzzleId === null ? null : puzzleLinkPath(puzzleId);
}
