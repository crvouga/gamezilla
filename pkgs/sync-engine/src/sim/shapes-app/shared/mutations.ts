import type { Topic } from '@pkgs/pubsub/interface';
import { sql } from '@pkgs/sql';
import { defineMutation } from '@pkgs/sync-engine/shared';
import { z } from 'zod';

import { SHAPE_KINDS } from './schema';
import { SHAPES_WORLD_TOPIC } from './topics';

const worldTopics = (): Topic[] => [SHAPES_WORLD_TOPIC];

const kindSchema = z.enum(SHAPE_KINDS);

/** Append a shape at the end of the ordered list. */
export const addShape = defineMutation({
  name: 'addShape',
  args: z.object({
    id: z.string(),
    kind: kindSchema,
  }),
  declaredWrites: ['shapes'],
  invalidates: worldTopics,
  affectedRows: ({ id }) => ({ shapes: [id] }),
  async run({ tx, env }, { id, kind }) {
    const maxRows = await tx.query(sql<{ max_key: number | null }>`
      SELECT MAX(sort_key) AS max_key FROM shapes WHERE _deleted_at IS NULL
    `);
    const nextKey = (maxRows[0]?.max_key ?? -1) + 1;
    await tx.run(sql`
      INSERT INTO shapes (id, kind, sort_key, owner_id)
      VALUES (${id}, ${kind}, ${nextKey}, ${env.actorId})
      ON CONFLICT (id) DO UPDATE SET
        kind = excluded.kind,
        sort_key = excluded.sort_key,
        owner_id = excluded.owner_id,
        _deleted_at = NULL
    `);
  },
});

/** Soft-delete a shape (shared lab whiteboard — any actor may remove). */
export const removeShape = defineMutation({
  name: 'removeShape',
  args: z.object({ id: z.string() }),
  declaredWrites: ['shapes'],
  invalidates: worldTopics,
  affectedRows: ({ id }) => ({ shapes: [id] }),
  async run({ tx, env }, { id }) {
    await tx.run(sql`
      UPDATE shapes
      SET _deleted_at = ${env.now().toISOString()}
      WHERE id = ${id} AND _deleted_at IS NULL
    `);
  },
});

/** Reassign sort_keys from a full ordered id list (DnD / shuffle commit). */
export const reorderShapes = defineMutation({
  name: 'reorderShapes',
  args: z.object({
    orderedIds: z.array(z.string()).min(1),
  }),
  declaredWrites: ['shapes'],
  invalidates: worldTopics,
  affectedRows: ({ orderedIds }) => ({ shapes: orderedIds }),
  async run({ tx }, { orderedIds }) {
    for (let i = 0; i < orderedIds.length; i += 1) {
      const id = orderedIds[i];
      if (id === undefined) continue;
      await tx.run(sql`
        UPDATE shapes
        SET sort_key = ${i}
        WHERE id = ${id} AND _deleted_at IS NULL
      `);
    }
  },
});
