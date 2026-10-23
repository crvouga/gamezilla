import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { queryRequires } from '@libs/permissions-shared-ts/query-permission';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineQuery } from '@pkgs/sync-engine-shared-ts/define-query';
import { z } from 'zod';
import { CONTENT_PAGE_SIZE, contentIds } from './content-query-scope';
import { contentId } from './content-types';

export const contentAttemptParams = z
  .object({
    gameId: contentId,
    beforeAt: z.string().max(40).default('9999-12-31T23:59:59.999Z'),
    beforeId: z.string().max(160).default(''),
    attemptId: contentId.optional(),
    sourceId: contentId.optional(),
    packRevisionId: contentId.optional(),
    unfinishedOnly: z.boolean().default(false),
  })
  .strict();

/** A page of personal attempts includes only their current positions and pinned content. */
export const puzzleContentAttemptsOwned = defineQuery({
  name: 'puzzleContentAttemptsOwned',
  params: contentAttemptParams,
  sampleParams: {
    gameId: 'game',
    beforeAt: '9999-12-31T23:59:59.999Z',
    beforeId: '',
    unfinishedOnly: false,
  },
  limit: CONTENT_PAGE_SIZE * 5,
  authorize: queryRequires(PERMISSION.puzzlesPlay),
  async run(ctx, params) {
    const actor = ctx.env.actorId;
    const selected =
      params.attemptId === undefined
        ? sql`(updated_at < ${params.beforeAt} OR (updated_at = ${params.beforeAt} AND id < ${params.beforeId}))`
        : sql`id = ${params.attemptId}`;
    const source =
      params.sourceId === undefined
        ? sql`1 = 1`
        : sql`source_id = ${params.sourceId}`;
    const pack =
      params.packRevisionId === undefined
        ? sql`1 = 1`
        : sql`pack_revision_id = ${params.packRevisionId}`;
    const unfinished = params.unfinishedOnly
      ? sql`NOT EXISTS (SELECT c.id FROM puzzle_content_completions c WHERE c.owner_id = ${actor} AND c.puzzle_revision_id = puzzle_content_attempts.source_id)`
      : sql`1 = 1`;
    const attempts = (
      await ctx.db.query(sql`
      SELECT * FROM puzzle_content_attempts WHERE owner_id = ${actor} AND game_id = ${params.gameId}
        AND ${selected} AND ${source} AND ${pack} AND ${unfinished} ORDER BY updated_at DESC, id DESC
    `)
    ).slice(0, CONTENT_PAGE_SIZE);
    const positions = attempts.map((row) => String(row['current_position_id']));
    const editions = attempts.flatMap((row) =>
      row['mode'] === 'ordinary' ? [String(row['source_id'])] : []
    );
    const packs = attempts.flatMap((row) =>
      typeof row['pack_revision_id'] === 'string'
        ? [row['pack_revision_id']]
        : []
    );
    const drafts = attempts.flatMap((row) =>
      row['mode'] === 'playtest' ? [String(row['source_id'])] : []
    );
    return {
      puzzle_content_attempts: attempts,
      puzzle_content_positions: await ctx.db.query(
        sql`SELECT * FROM puzzle_content_positions WHERE owner_id = ${actor} AND id IN (${contentIds(positions)}) ORDER BY id`
      ),
      puzzle_content_completions: await ctx.db.query(
        sql`SELECT * FROM puzzle_content_completions WHERE owner_id = ${actor} AND puzzle_revision_id IN (${contentIds(editions)}) ORDER BY id`
      ),
      puzzle_content_revisions: await ctx.db.query(
        sql`SELECT * FROM puzzle_content_revisions WHERE id IN (${contentIds([...editions, ...packs])}) ORDER BY id`
      ),
      puzzle_content_drafts: await ctx.db.query(
        sql`SELECT * FROM puzzle_content_drafts WHERE owner_id = ${actor} AND id IN (${contentIds(drafts)}) ORDER BY id`
      ),
    };
  },
});

export const puzzleContentPositionsOwned = defineQuery({
  name: 'puzzleContentPositionsOwned',
  params: z
    .object({ attemptId: contentId, afterId: z.string().max(160).default('') })
    .strict(),
  sampleParams: { attemptId: 'attempt', afterId: '' },
  limit: CONTENT_PAGE_SIZE,
  authorize: queryRequires(PERMISSION.puzzlesPlay),
  async run(ctx, { attemptId, afterId }) {
    return {
      puzzle_content_positions: (
        await ctx.db.query(sql`
      SELECT * FROM puzzle_content_positions WHERE owner_id = ${ctx.env.actorId}
        AND attempt_id = ${attemptId} AND id > ${afterId} ORDER BY id
    `)
      ).slice(0, CONTENT_PAGE_SIZE),
    };
  },
});

/** Progress for the selected edition batch, including tombstones and no playtest completions. */
export const puzzleContentCompletionsOwned = defineQuery({
  name: 'puzzleContentCompletionsOwned',
  params: z
    .object({ revisionIds: z.array(contentId).min(1).max(CONTENT_PAGE_SIZE) })
    .strict(),
  sampleParams: { revisionIds: ['edition'] },
  limit: CONTENT_PAGE_SIZE,
  authorize: queryRequires(PERMISSION.puzzlesPlay),
  async run(ctx, { revisionIds }) {
    return {
      puzzle_content_completions: await ctx.db.query(
        sql`SELECT * FROM puzzle_content_completions WHERE owner_id = ${ctx.env.actorId} AND puzzle_revision_id IN (${contentIds(revisionIds)}) ORDER BY id`
      ),
    };
  },
});
