import type { AttemptLibrary } from '@libs/game-puzzle-shared-ts/attempt-library';
import { projectAttemptPosition } from '@libs/game-puzzle-shared-ts/attempt-library';
import type { ContentLibrary } from '@libs/game-puzzle-shared-ts/content-library';
import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';

/** A completed real playtest can prove the identical game definition after metadata edits. */
export function contentPlaytestProof(args: {
  readonly content: ContentLibrary;
  readonly play: AttemptLibrary;
  readonly game: PuzzleContent;
  readonly documentId: string;
  readonly definition: string;
}): string | undefined {
  for (const attempt of args.play.attempts) {
    if (attempt.mode !== 'playtest' || attempt.puzzle_id !== args.documentId)
      continue;
    const draft = args.content.drafts.find(
      (entry) => entry.id === attempt.source_id
    );
    if (draft?.definition !== args.definition) continue;
    const position = args.play.positions.find(
      (entry) => entry.id === attempt.current_position_id
    );
    if (position === undefined) continue;
    const progress = projectAttemptPosition({
      position,
      definition: args.definition,
      game: args.game,
    });
    if (progress?.complete === true) return progress.state;
  }
  return undefined;
}
