import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

import { SHAPES_WORLD_TOPIC } from './topics';

/**
 * Global shapes hydrate — all sim clients share scope for convergence.
 * Snapshots include soft-deleted rows (tombstones).
 */
export const shapesWorldQuery = defineQuery({
  name: 'shapesWorld',
  limit: 500,
  entryChannel: () => [SHAPES_WORLD_TOPIC],
  async run({ db }) {
    const shapes = await db.query(sql<{
      id: string;
      kind: string;
      sort_key: number;
      owner_id: string;
      _deleted_at: string | null;
    }>`
      SELECT id, kind, sort_key, owner_id, _deleted_at FROM shapes
      ORDER BY sort_key ASC, id ASC
`);
    return { shapes };
  },
});
