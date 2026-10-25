import sql from '@pkgs/sql-root-shared-ts/sql';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';
import { z } from 'zod';
import { nextAttemptActivity } from './attempt-activity';
import { recordAttemptCompletion } from './attempt-completion';
import { readAttemptPosition, readContentAttempt } from './attempt-store';
import type { ContentAttempt } from './attempt-types';
import type { ContentMutationCtx } from './content-store';
import { contentGame } from './content-store';
import { contentId } from './content-types';

export const attemptStartSchema = z.object({
  attemptId: contentId,
  positionId: contentId,
});
export type AttemptStart = z.infer<typeof attemptStartSchema>;
export type AttemptSource = {
  readonly puzzleId: string;
  readonly sourceId: string;
  readonly gameId: string;
  readonly definition: string;
  readonly mode: 'ordinary' | 'playtest';
  readonly packRevisionId: string | null;
  /** The rules the source is played under: an edition's, or the current rules for a draft. */
  readonly rulesVersion: number;
};

/** An edition plays only under the rules it was published with; saved attempts stay kept. */
export function requireAttemptRules(
  game: PuzzleContent,
  rulesVersion: number
): void {
  if (rulesVersion !== game.rulesVersion)
    throw new MutationError(
      'PUZZLE_RULES_CHANGED',
      'This puzzle needs a version of the app with its rules. Your saved attempts stay kept.'
    );
}

export async function createContentAttempt(
  ctx: ContentMutationCtx,
  args: AttemptStart,
  source: AttemptSource
): Promise<void> {
  const existing = await readContentAttempt(ctx.tx, args.attemptId);
  if (existing !== null) {
    if (
      existing.owner_id !== ctx.env.actorId ||
      existing.puzzle_id !== source.puzzleId ||
      existing.source_id !== source.sourceId ||
      existing.mode !== source.mode ||
      existing.pack_revision_id !== source.packRevisionId
    )
      throw new MutationError(
        'PUZZLE_ATTEMPT_ID_REUSED',
        'This attempt identity is already used. Start a new attempt.'
      );
    const first = await readAttemptPosition(ctx.tx, existing, args.positionId);
    if (first.parent_id !== null)
      throw new MutationError(
        'PUZZLE_POSITION_ID_REUSED',
        'Choose a new starting position identity.'
      );
    return;
  }
  const game = contentGame(ctx.puzzleContents, source.gameId);
  requireAttemptRules(game, source.rulesVersion);
  const initial = game.rules.initial(source.definition);
  if (!initial.accepted)
    throw new MutationError(
      'PUZZLE_DETAILS_INVALID',
      initial.issues[0]?.message ?? 'Choose a valid puzzle.'
    );
  const attempt: ContentAttempt = {
    id: args.attemptId,
    owner_id: ctx.env.actorId,
    puzzle_id: source.puzzleId,
    source_id: source.sourceId,
    game_id: source.gameId,
    mode: source.mode,
    pack_revision_id: source.packRevisionId,
    current_position_id: args.positionId,
    activity_order: await nextAttemptActivity(ctx.tx, ctx.env.actorId),
    rules_version: game.rulesVersion,
    deleted_at: null,
    updated_at: ctx.env.now().toISOString(),
  };
  await ctx.tx.run(sql`
    INSERT INTO puzzle_content_attempts (id, owner_id, puzzle_id, source_id, game_id, mode, pack_revision_id, current_position_id, activity_order, rules_version)
    VALUES (${attempt.id}, ${attempt.owner_id}, ${attempt.puzzle_id}, ${attempt.source_id}, ${attempt.game_id}, ${attempt.mode}, ${attempt.pack_revision_id}, ${args.positionId}, ${attempt.activity_order}, ${attempt.rules_version})
  `);
  const history = JSON.stringify({
    entries: [{ action: null, state: initial.state }],
    cursor: 0,
  });
  await ctx.tx.run(sql`
    INSERT INTO puzzle_content_positions (id, owner_id, attempt_id, parent_id, history, conflicted)
    VALUES (${args.positionId}, ${attempt.owner_id}, ${attempt.id}, ${null}, ${history}, ${false})
  `);
  await recordAttemptCompletion(ctx, {
    attempt,
    positionId: args.positionId,
    game,
    definition: source.definition,
    state: initial.state,
  });
}
