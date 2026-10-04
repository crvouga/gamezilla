import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import sql, { ident } from '@pkgs/sql-shared/sql';
import type { TopicMap, TopicMapCtx } from './topic-map';
import type { QueryRow } from './v2';

/**
 * Drop local post-images that a topic-map `rowImage.publish` vetoes.
 * Tables without a publish guard pass through unchanged.
 */
export function filterPublishableImages(
  rows: Readonly<Record<string, readonly QueryRow[]>>,
  topicMap: TopicMap | undefined,
  ctx: TopicMapCtx
): Readonly<Record<string, readonly QueryRow[]>> {
  if (topicMap === undefined) return rows;
  let changed = false;
  const next: Record<string, readonly QueryRow[]> = {};
  for (const [table, tableRows] of Object.entries(rows)) {
    const publish = topicMap[table]?.rowImage?.publish;
    if (publish === undefined) {
      next[table] = tableRows;
      continue;
    }
    const kept = tableRows.filter((row) => publish(row, ctx));
    if (kept.length !== tableRows.length) changed = true;
    if (kept.length > 0) next[table] = kept;
  }
  return changed ? next : rows;
}

/**
 * Drop incoming optimistic images that a topic-map `rowImage.accept` vetoes.
 * Looks up the local row by `id` when an accept guard is present.
 */
export async function filterAcceptableImages(
  db: SqlClient,
  rows: Readonly<Record<string, readonly QueryRow[]>>,
  topicMap: TopicMap | undefined,
  ctx: TopicMapCtx
): Promise<Readonly<Record<string, readonly QueryRow[]>>> {
  if (topicMap === undefined) return rows;
  let changed = false;
  const next: Record<string, readonly QueryRow[]> = {};
  for (const [table, tableRows] of Object.entries(rows)) {
    const accept = topicMap[table]?.rowImage?.accept;
    if (accept === undefined) {
      next[table] = tableRows;
      continue;
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
      next[table] = tableRows;
      continue;
    }
    const kept: QueryRow[] = [];
    for (const incoming of tableRows) {
      const id = incoming['id'];
      let local: QueryRow | null = null;
      if (typeof id === 'string' && id.length > 0) {
        const found = await db.query(sql<QueryRow>`
          SELECT * FROM ${ident(table)} WHERE id = ${id} LIMIT 1
        `);
        local = found[0] ?? null;
      }
      if (accept(incoming, local, ctx)) kept.push(incoming);
      else changed = true;
    }
    if (kept.length > 0) next[table] = kept;
    else if (tableRows.length > 0) changed = true;
  }
  return changed ? next : rows;
}
