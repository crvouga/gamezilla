import type { ContentKind } from '@libs/game-puzzle-shared-ts/content-types';
import type { PuzzleContentClient } from './puzzle-content-client';

/**
 * Whether the builder may treat a draft as playable: `false` only for a
 * puzzle draft whose board the game says it cannot read (its authoring
 * `readable()`). A pack's definition is a list of puzzles, not a board,
 * so a pack is never asked.
 */
export function contentDraftPlayable(
  client: PuzzleContentClient,
  kind: ContentKind,
  definition: string
): boolean {
  if (kind !== 'puzzle') return true;
  return client.authoring?.readable?.(definition) !== false;
}
