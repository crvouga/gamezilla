import sql from '@pkgs/sql-root-shared-ts/sql';
import {
  type MutationCtx,
  MutationError,
} from '@pkgs/sync-engine-shared-ts/mutations-types';
import { nextAttemptActivity } from './attempt-activity';
import type { AttemptPosition, ContentAttempt } from './attempt-types';

export async function saveAttemptPosition(
  ctx: MutationCtx,
  args: {
    readonly attempt: ContentAttempt;
    readonly positionId: string;
    readonly parentId: string;
    readonly history: string;
    readonly onConflict: 'keep' | 'refuse';
  }
): Promise<void> {
  const existing = (
    await ctx.tx.query(
      sql<AttemptPosition>`SELECT * FROM puzzle_content_positions WHERE id = ${args.positionId}`
    )
  )[0];
  if (existing !== undefined) {
    if (
      existing.attempt_id !== args.attempt.id ||
      existing.parent_id !== args.parentId ||
      existing.history !== args.history
    )
      throw new MutationError(
        'PUZZLE_POSITION_ID_REUSED',
        'This position identity is already used. Save a new continuation.'
      );
  } else
    await ctx.tx.run(sql`
    INSERT INTO puzzle_content_positions (id, owner_id, attempt_id, parent_id, history, conflicted)
    VALUES (${args.positionId}, ${args.attempt.owner_id}, ${args.attempt.id}, ${args.parentId}, ${args.history}, ${false})
  `);
  const changed = await ctx.tx.run(sql`
    UPDATE puzzle_content_attempts SET current_position_id = ${args.positionId},
      activity_order = ${await nextAttemptActivity(ctx.tx, args.attempt.owner_id)}
    WHERE id = ${args.attempt.id} AND current_position_id = ${args.parentId} AND deleted_at IS NULL
  `);
  if (changed.changes > 0 || existing !== undefined) return;
  if (args.onConflict === 'refuse')
    throw new MutationError(
      'PUZZLE_CONTINUATION_CHANGED',
      'Your chosen continuation changed. Review the kept positions and choose again.'
    );
  await ctx.tx.run(sql`
    UPDATE puzzle_content_positions SET conflicted = ${true} WHERE id = ${args.positionId}
  `);
}
