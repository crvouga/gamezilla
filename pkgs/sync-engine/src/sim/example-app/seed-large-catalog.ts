import { sql } from '@pkgs/sql';

import type { SimServer } from '../../../sim/server';
import { NOTES_ALL_TOPIC } from './shared/topics';

/** Chess-scale catalog hydrate (~2k rows) for large-snapshot DST pins. */
export async function seedLargeCatalogNotes(
  server: SimServer,
  args: {
    readonly count: number;
    readonly notify?: boolean;
  }
): Promise<void> {
  const count = Math.max(1, Math.min(args.count, 5_000));
  const ownerId = 'seed';
  await server.db.transaction(async (tx) => {
    for (let i = 0; i < count; i += 1) {
      const id = `bulk-${i}`;
      await tx.run(sql`
        INSERT INTO notes (id, folder_id, title, body, owner_id)
        VALUES (${id}, NULL, ${''}, ${'bulk-body'}, ${ownerId})
      `);
    }
  });
  if (args.notify === true) {
    await server.notifyFanout({
      topics: [NOTES_ALL_TOPIC],
      tables: ['notes'],
      label: 'seedLargeCatalogNotes',
    });
  }
}
