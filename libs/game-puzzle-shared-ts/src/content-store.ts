import { requireInMutation } from '@libs/permissions-shared-ts/mutation-permission';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type {
  MutationCtx,
  MutationDb,
  MutationEnv,
} from '@pkgs/sync-engine-shared-ts/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';
import type {
  ContentDocument,
  ContentDraft,
  ContentDraftRow,
  ContentRevision,
} from './content-types';
import { contentDraftOf } from './content-types';

export function contentGame(env: MutationEnv, id: string): PuzzleContent {
  if (env.puzzleContents === undefined)
    throw new Error(
      'The composition root must inject puzzle content capabilities'
    );
  const game = env.puzzleContents.byId(id);
  if (game === undefined)
    throw new MutationError(
      'PUZZLE_GAME_UNAVAILABLE',
      'Choose a game that offers puzzle creation.'
    );
  return game;
}

export async function readContentDocument(
  tx: MutationDb,
  id: string
): Promise<ContentDocument | null> {
  const rows = await tx.query(
    sql<ContentDocument>`SELECT * FROM puzzle_content_documents WHERE id = ${id} AND deleted_at IS NULL`
  );
  return rows[0] ?? null;
}

export async function requireContentAuthor(
  ctx: MutationCtx,
  id: string,
  permission:
    | typeof PERMISSION.puzzlesEditContent
    | typeof PERMISSION.puzzlesPublishContent
    | typeof PERMISSION.puzzlesPlaytestContent = PERMISSION.puzzlesEditContent
): Promise<ContentDocument> {
  const doc = await readContentDocument(ctx.tx, id);
  await requireInMutation(ctx, permission, {
    puzzleOwnerId: doc?.owner_id ?? '',
  });
  if (doc === null)
    throw new MutationError(
      'PUZZLE_CONTENT_UNAVAILABLE',
      'This puzzle or pack is unavailable. Return to your drafts.'
    );
  return doc;
}

export async function readContentDraft(
  tx: MutationDb,
  id: string
): Promise<ContentDraft | null> {
  const rows = await tx.query(
    sql<ContentDraftRow>`SELECT * FROM puzzle_content_drafts WHERE id = ${id} AND deleted_at IS NULL`
  );
  const row = rows[0];
  return row === undefined ? null : contentDraftOf(row);
}

export async function readContentRevision(
  tx: MutationDb,
  id: string
): Promise<ContentRevision | null> {
  const rows = await tx.query(
    sql<ContentRevision>`SELECT * FROM puzzle_content_revisions WHERE id = ${id} AND deleted_at IS NULL`
  );
  return rows[0] ?? null;
}

export function requireDraftOf(
  doc: ContentDocument,
  draft: ContentDraft | null
): ContentDraft {
  if (draft === null || draft.document_id !== doc.id)
    throw new MutationError(
      'PUZZLE_DRAFT_UNAVAILABLE',
      'This saved draft is unavailable. Open one of your kept draft copies.'
    );
  return draft;
}
