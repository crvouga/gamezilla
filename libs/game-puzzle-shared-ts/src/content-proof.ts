import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';
import type { AttemptLibrary } from './attempt-library';
import { projectAttemptPosition } from './attempt-library';
import { replayContentEvidence } from './content-evidence';
import type { ContentLibrary } from './content-library';
import type { ContentDraft } from './content-types';

/**
 * What can prove a draft's current definition: the newest completed playtest
 * of exactly that definition under the current rules, or evidence a passed
 * check kept. Publication replays either one again before relying on it.
 */
export type ContentProof =
  | { readonly kind: 'playtest'; readonly attemptId: string }
  | { readonly kind: 'kept' };

export function contentDraftProof(args: {
  readonly content: ContentLibrary;
  readonly play: AttemptLibrary;
  readonly game: PuzzleContent;
  readonly draft: Pick<
    ContentDraft,
    'document_id' | 'definition' | 'validation_solution'
  >;
}): ContentProof | null {
  const { draft, game } = args;
  const playtests = args.play.attempts
    .filter(
      (attempt) =>
        attempt.mode === 'playtest' &&
        attempt.puzzle_id === draft.document_id &&
        attempt.rules_version === game.rulesVersion &&
        attempt.deleted_at === null
    )
    .toSorted((a, b) => b.activity_order - a.activity_order);
  for (const attempt of playtests) {
    const played = args.content.drafts.find(
      (entry) => entry.id === attempt.source_id
    );
    if (played?.definition !== draft.definition) continue;
    const position = args.play.positions.find(
      (entry) => entry.id === attempt.current_position_id
    );
    if (position === undefined) continue;
    const progress = projectAttemptPosition({
      position,
      definition: draft.definition,
      game,
    });
    if (progress?.complete === true)
      return { kind: 'playtest', attemptId: attempt.id };
  }
  const kept = replayContentEvidence(
    game,
    draft.definition,
    draft.validation_solution
  );
  return kept !== null && game.rules.complete(draft.definition, kept.state)
    ? { kind: 'kept' }
    : null;
}
