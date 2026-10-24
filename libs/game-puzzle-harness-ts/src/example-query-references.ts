import {
  puzzleContentEditions,
  puzzleContentPackItems,
} from '@libs/game-puzzle-shared-ts/content-detail-queries';
import { CONTENT_PAGE_SIZE } from '@libs/game-puzzle-shared-ts/content-query-scope';
import { CONTENT_TABLES } from '@libs/game-puzzle-shared-ts/content-tables';
import type { QueryCtx } from '@pkgs/sync-engine-shared-ts/queries-types';
import type { QueryRow } from '@pkgs/sync-engine-shared-ts/v2';

type Snapshot = Readonly<Record<string, readonly QueryRow[]>>;

export function mergeContentSnapshots(
  snapshots: readonly Snapshot[]
): Snapshot {
  const tables = new Map<string, Map<string, QueryRow>>(
    CONTENT_TABLES.map((table) => [table.name, new Map<string, QueryRow>()])
  );
  for (const snapshot of snapshots)
    for (const [name, rows] of Object.entries(snapshot)) {
      const merged = tables.get(name) ?? new Map<string, QueryRow>();
      for (const row of rows) merged.set(String(row['id']), row);
      tables.set(name, merged);
    }
  return Object.fromEntries(
    [...tables].map(([name, rows]) => [name, [...rows.values()]])
  );
}

async function editions(
  ctx: QueryCtx,
  ids: readonly string[]
): Promise<readonly Snapshot[]> {
  const unique = [...new Set(ids)];
  const results: Snapshot[] = [];
  for (let start = 0; start < unique.length; start += CONTENT_PAGE_SIZE)
    results.push(
      await puzzleContentEditions.run(ctx, {
        ids: unique.slice(start, start + CONTENT_PAGE_SIZE),
      })
    );
  return results;
}

/** The reference app chooses retained copies and saved pack references through the production reads. */
export async function exampleReferencedEditions(
  ctx: QueryCtx,
  base: Snapshot
): Promise<readonly Snapshot[]> {
  const history = await editions(
    ctx,
    (base['puzzle_content_drafts'] ?? []).map((row) => String(row['id']))
  );
  const revised = mergeContentSnapshots([base, ...history]);
  const packs = (revised['puzzle_content_revisions'] ?? []).filter(
    (row) => row['kind'] === 'pack'
  );
  const items = await Promise.all(
    packs.map((row) =>
      puzzleContentPackItems.run(ctx, { revisionId: String(row['id']) })
    )
  );
  const children = items.flatMap((snapshot) =>
    (snapshot['puzzle_content_pack_items'] ?? []).map((row) =>
      String(row['puzzle_revision_id'])
    )
  );
  return [...history, ...items, ...(await editions(ctx, children))];
}
