import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { ShapeKind } from './shared/schema';

export type LiveShape = {
  readonly id: string;
  readonly kind: ShapeKind;
  readonly sort_key: number;
  readonly owner_id: string;
};

/** Live (non-tombstoned) shapes ordered by sort_key then id. */
export async function readLiveShapes(
  db: SqlClient
): Promise<readonly LiveShape[]> {
  const rows = await db.query(sql<{
    id: string;
    kind: string;
    sort_key: number;
    owner_id: string;
  }>`
    SELECT id, kind, sort_key, owner_id
    FROM shapes
    WHERE _deleted_at IS NULL
    ORDER BY sort_key ASC, id ASC
  `);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as ShapeKind,
    sort_key: r.sort_key,
    owner_id: r.owner_id,
  }));
}

function shapesKey(shapes: readonly LiveShape[]): string {
  return JSON.stringify(
    shapes.map((s) => ({ id: s.id, kind: s.kind, sort_key: s.sort_key }))
  );
}

/** True when live ordered shapes match between two DBs. */
export async function shapesMatch(
  a: SqlClient,
  b: SqlClient
): Promise<boolean> {
  const left = await readLiveShapes(a);
  const right = await readLiveShapes(b);
  return shapesKey(left) === shapesKey(right);
}
