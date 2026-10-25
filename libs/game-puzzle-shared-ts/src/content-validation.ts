import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type {
  PuzzleEvidence,
  PuzzleValidation,
} from '@pkgs/turn-game-shared-ts/puzzle-content';
import { readAttemptPosition, requireAttemptPlayer } from './attempt-store';
import { decodeAttemptHistory } from './attempt-types';
import { playtestEvidence, replayContentEvidence } from './content-evidence';
import { validatePackDefinition } from './content-pack';
import type { ContentMutationCtx } from './content-store';
import { contentGame, readContentDraft } from './content-store';
import type { ContentDocument, ContentDraft } from './content-types';

export type ContentDraftCheck = {
  readonly validation: PuzzleValidation;
  /** Replayed evidence the check relied on, to keep with the draft. */
  readonly evidence: PuzzleEvidence | null;
};

async function referencedEvidence(
  ctx: ContentMutationCtx,
  doc: ContentDocument,
  draft: ContentDraft,
  playtestAttemptId: string
): Promise<PuzzleEvidence> {
  const game = contentGame(ctx.puzzleContents, doc.game_id);
  const attempt = await requireAttemptPlayer(ctx, playtestAttemptId);
  const position = await readAttemptPosition(
    ctx.tx,
    attempt,
    attempt.current_position_id
  );
  const played = await readContentDraft(ctx.tx, attempt.source_id);
  const history = decodeAttemptHistory(position.history);
  if (history === null)
    throw new MutationError(
      'PUZZLE_PLAYTEST_UNAVAILABLE',
      'This playtest cannot be replayed. Complete a new playtest.'
    );
  return playtestEvidence({
    game,
    attempt,
    documentId: doc.id,
    playedDefinition: played?.definition ?? '',
    definition: draft.definition,
    history,
  });
}

/** Always called again during publication; a saved valid flag is never authority. */
export async function validateContentDraft(
  ctx: ContentMutationCtx,
  doc: ContentDocument,
  draft: ContentDraft,
  playtestAttemptId?: string
): Promise<ContentDraftCheck> {
  const refused = (code: string, message: string): ContentDraftCheck => ({
    validation: { valid: false, issues: [{ code, message }] },
    evidence: null,
  });
  if (draft.title.trim().length === 0)
    return refused(
      'PUZZLE_TITLE_REQUIRED',
      'Name the puzzle or pack before publication.'
    );
  const game = contentGame(ctx.puzzleContents, doc.game_id);
  if (doc.kind === 'pack')
    return {
      validation: await validatePackDefinition(ctx.tx, doc, draft.definition),
      evidence: null,
    };
  const structural = game.rules.validateDefinition(draft.definition);
  if (!structural.valid) return { validation: structural, evidence: null };
  const evidence =
    playtestAttemptId === undefined
      ? replayContentEvidence(game, draft.definition, draft.validation_solution)
      : await referencedEvidence(ctx, doc, draft, playtestAttemptId);
  if (
    evidence !== null &&
    !game.rules.complete(draft.definition, evidence.state)
  )
    return refused(
      'PUZZLE_PLAYTEST_INCOMPLETE',
      'Complete the playtest before using it as publication proof.'
    );
  return {
    validation:
      game.validatePublication?.(draft.definition, evidence ?? undefined) ??
      ({ valid: true } as const),
    evidence,
  };
}
