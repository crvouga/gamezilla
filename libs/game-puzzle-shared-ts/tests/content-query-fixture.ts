import { CONTENT_QUERIES } from '@libs/game-puzzle-shared-ts/content-query-registry';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql, { join, type Sql } from '@pkgs/sql-root-shared-ts/sql';
import {
  type QueryTruncation,
  runQuery,
} from '@pkgs/sync-engine-server-ts/run-query';
import { queryRegistry } from '@pkgs/sync-engine-shared-ts/queries-registry';
import type { ContentFixture } from './content-fixture';
import { withContentFixture } from './content-fixture';

/** The same example data on the native in-process SQL port keeps a large transport contract fast. */
export const withContentQueryFixture = (
  run: (fixture: ContentFixture) => Promise<void>
) => withContentFixture(run, SqlClientImplBunSqlite.openMemory());

const stamp = '2026-10-23T00:00:00.000Z';
export const contentQueryId = (index: number): string =>
  `p${String(index).padStart(4, '0')}`;

export async function insertRows(
  fixture: ContentFixture,
  statement: Sql<unknown>,
  rows: readonly Sql<unknown>[]
): Promise<void> {
  for (let start = 0; start < rows.length; start += 64)
    await fixture.db.run(
      sql`${statement} VALUES ${join(rows.slice(start, start + 64))}`
    );
}

/** A literal catalogue larger than the default snapshot budget, with many old copies of its first puzzle. */
export async function seedLargeContentCatalogue(
  fixture: ContentFixture
): Promise<void> {
  const ids = Array.from({ length: 1_025 }, (_, index) =>
    contentQueryId(index)
  );
  await insertRows(
    fixture,
    sql`INSERT INTO puzzle_content_documents (id, owner_id, game_id, kind, working_draft_id, published_revision_id, publication_count, status, created_at, updated_at, deleted_at)`,
    ids.map(
      (id) =>
        sql`(${id}, ${'alice'}, ${'pile'}, ${'puzzle'}, ${`${id}-edition`}, ${`${id}-edition`}, ${1}, ${'published'}, ${stamp}, ${stamp}, ${null})`
    )
  );
  await insertRows(
    fixture,
    sql`INSERT INTO puzzle_content_publications (id, owner_id, game_id, kind, published_revision_id, publication_count, status, created_at, updated_at, deleted_at)`,
    ids.map(
      (id) =>
        sql`(${id}, ${'alice'}, ${'pile'}, ${'puzzle'}, ${`${id}-edition`}, ${1}, ${'published'}, ${stamp}, ${stamp}, ${null})`
    )
  );
  await insertRows(
    fixture,
    sql`INSERT INTO puzzle_content_revisions (id, document_id, owner_id, game_id, kind, edition, title, description, difficulty, definition, rules_version, created_at, updated_at, deleted_at)`,
    ids.map(
      (id) =>
        sql`(${`${id}-edition`}, ${id}, ${'alice'}, ${'pile'}, ${'puzzle'}, ${1}, ${id}, ${''}, ${''}, ${'pile:3:white'}, ${1}, ${stamp}, ${stamp}, ${null})`
    )
  );
  const drafts = ids.map((id) => ({ id: `${id}-edition`, documentId: id }));
  for (let index = 0; index < 1_025; index++)
    drafts.push({
      id: `copy-${String(index).padStart(4, '0')}`,
      documentId: 'p0000',
    });
  await insertRows(
    fixture,
    sql`INSERT INTO puzzle_content_drafts (id, document_id, owner_id, parent_id, title, description, difficulty, definition, conflicted, validation_status, validation_issues, validation_solution, created_at, updated_at, deleted_at)`,
    drafts.map(
      (draft) =>
        sql`(${draft.id}, ${draft.documentId}, ${'alice'}, ${null}, ${draft.documentId}, ${''}, ${''}, ${'pile:3:white'}, ${false}, ${'valid'}, ${'[]'}, ${null}, ${stamp}, ${stamp}, ${null})`
    )
  );
}

export function contentQueryRunner(fixture: ContentFixture) {
  const truncations: QueryTruncation[] = [];
  const reads: number[] = [];
  const query = fixture.db.query.bind(fixture.db);
  fixture.db.query = async (statement) => {
    const rows = await query(statement);
    reads.push(rows.length);
    return rows;
  };
  let checkpoint = 0;
  const run = (name: string, params: unknown) =>
    runQuery(
      {
        db: fixture.db,
        registry: queryRegistry(CONTENT_QUERIES),
        auth: fixture.env,
        nextCheckpoint: () => String(++checkpoint),
        strictQueryLimits: true,
        onTruncated: (event) => truncations.push(event),
      },
      { name, params }
    );
  return { run, truncations, reads };
}
