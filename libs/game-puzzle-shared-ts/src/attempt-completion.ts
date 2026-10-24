import sql from '@pkgs/sql-root-shared-ts/sql';
import type { MutationCtx } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';
import type { ContentAttempt } from './attempt-types';

export async function recordAttemptCompletion(
  ctx: MutationCtx,
  args: {
    readonly attempt: ContentAttempt;
    readonly positionId: string;
    readonly game: PuzzleContent;
    readonly definition: string;
    readonly state: string;
  }
): Promise<void> {
  if (
    args.attempt.mode !== 'ordinary' ||
    !args.game.rules.complete(args.definition, args.state)
  )
    return;
  const attempt = args.attempt;
  const statistics = JSON.stringify(
    args.game.statistics?.(args.definition, args.state) ?? {}
  );
  await ctx.tx.run(sql`
    INSERT INTO puzzle_content_completions
      (id, owner_id, puzzle_id, puzzle_revision_id, attempt_id, position_id, statistics)
    VALUES (${`${attempt.owner_id}:${attempt.source_id}`}, ${attempt.owner_id}, ${attempt.puzzle_id},
      ${attempt.source_id}, ${attempt.id}, ${args.positionId}, ${statistics})
    ON CONFLICT (owner_id, puzzle_revision_id) DO NOTHING
  `);
}
