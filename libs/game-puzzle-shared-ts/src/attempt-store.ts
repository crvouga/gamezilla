import { requireInMutation } from '@libs/permissions-shared-ts/mutation-permission';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import sql from '@pkgs/sql-root-shared-ts/sql';
import {
  type MutationCtx,
  type MutationDb,
  MutationError,
} from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { AttemptPosition, ContentAttempt } from './attempt-types';
import {
  type ContentMutationCtx,
  readContentDraft,
  readEdition,
} from './content-store';

export async function readContentAttempt(
  tx: MutationDb,
  id: string
): Promise<ContentAttempt | null> {
  return (
    (
      await tx.query(
        sql<ContentAttempt>`SELECT * FROM puzzle_content_attempts WHERE id = ${id} AND deleted_at IS NULL`
      )
    )[0] ?? null
  );
}

export async function requireAttemptPlayer(
  ctx: MutationCtx,
  id: string
): Promise<ContentAttempt> {
  const attempt = await readContentAttempt(ctx.tx, id);
  await requireInMutation(ctx, PERMISSION.puzzlesEditAttempt, {
    puzzlePlayerId: attempt?.owner_id ?? '',
  });
  if (attempt === null)
    throw new MutationError(
      'PUZZLE_ATTEMPT_UNAVAILABLE',
      'Open one of your saved puzzle attempts.'
    );
  return attempt;
}

export async function attemptDefinition(
  ctx: ContentMutationCtx,
  attempt: ContentAttempt
): Promise<string> {
  const source =
    attempt.mode === 'playtest'
      ? await readContentDraft(ctx.tx, attempt.source_id)
      : await readEdition(ctx, attempt.source_id);
  if (source === null || source.document_id !== attempt.puzzle_id)
    throw new MutationError(
      'PUZZLE_EDITION_UNAVAILABLE',
      'This puzzle edition is unavailable. Your attempt is kept; choose another available puzzle.'
    );
  return source.definition;
}

export async function readAttemptPosition(
  tx: MutationDb,
  attempt: ContentAttempt,
  id: string
): Promise<AttemptPosition> {
  const position = (
    await tx.query(
      sql<AttemptPosition>`SELECT * FROM puzzle_content_positions WHERE id = ${id} AND attempt_id = ${attempt.id} AND deleted_at IS NULL`
    )
  )[0];
  if (position === undefined)
    throw new MutationError(
      'PUZZLE_POSITION_UNAVAILABLE',
      'Open one of the kept puzzle continuations.'
    );
  return position;
}
