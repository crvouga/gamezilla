import sql from '@pkgs/sql-root-shared-ts/sql';
import type { ContentFixture } from './content-fixture';
import { contentQueryId, insertRows } from './content-query-fixture';

/** A saved-play catalogue and one long retained history exceed a single page. */
export async function seedLargeAttemptCatalogue(
  fixture: ContentFixture
): Promise<void> {
  const ids = Array.from({ length: 1_025 }, (_, index) =>
    contentQueryId(index)
  );
  const stamp = '2026-10-23T00:00:00.000Z';
  await insertRows(
    fixture,
    sql`INSERT INTO puzzle_content_attempts (id, owner_id, puzzle_id, source_id, game_id, mode, pack_revision_id, current_position_id, activity_order, rules_version, created_at, updated_at, deleted_at)`,
    ids.map(
      (id, index) =>
        sql`(${`attempt-${id}`}, ${'alice'}, ${'p0000'}, ${'p0000-edition'}, ${'pile'}, ${'ordinary'}, ${null}, ${`position-${id}`}, ${index}, ${1}, ${stamp}, ${stamp}, ${null})`
    )
  );
  const positions = ids.map((id) => ({
    id: `position-${id}`,
    attempt: `attempt-${id}`,
    parent: null as string | null,
  }));
  positions.push(
    ...ids.map((id) => ({
      id: `earlier-${id}`,
      attempt: 'attempt-p0000',
      parent: 'position-p0000',
    }))
  );
  const history = JSON.stringify({
    entries: [{ action: null, state: 'pile:3:white' }],
    cursor: 0,
  });
  await insertRows(
    fixture,
    sql`INSERT INTO puzzle_content_positions (id, owner_id, attempt_id, parent_id, history, conflicted, created_at, updated_at, deleted_at)`,
    positions.map(
      (position) =>
        sql`(${position.id}, ${'alice'}, ${position.attempt}, ${position.parent}, ${history}, ${false}, ${stamp}, ${stamp}, ${null})`
    )
  );
}
