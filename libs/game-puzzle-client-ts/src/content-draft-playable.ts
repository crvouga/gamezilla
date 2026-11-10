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

/**
 * Whether the builder's Preview may open a draft. A game with its own
 * `Preview` draws the board as built, incomplete or not, so only a game
 * that previews through its player waits until the draft is playable.
 */
export function contentDraftPreviewable(
  client: PuzzleContentClient,
  kind: ContentKind,
  definition: string
): boolean {
  if (client.Preview !== undefined) return true;
  return contentDraftPlayable(client, kind, definition);
}
