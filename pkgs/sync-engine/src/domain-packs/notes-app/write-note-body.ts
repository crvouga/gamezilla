import { sql } from '@pkgs/sql';

import type { SimServer } from '../../sim/server';
import { NOTES_WORLD_TOPIC } from './shared/topics';

/**
 * Direct domain write bypassing mutations. When `notify` is false, peers
 * stay stale until a refetch trigger (documented footgun).
 */
export async function writeNoteBody(
  server: SimServer,
  args: {
    readonly id: string;
    readonly body: string;
    readonly notify?: boolean;
  }
): Promise<void> {
  await server.db.run(sql`
    UPDATE notes SET body = ${args.body} WHERE id = ${args.id}
  `);
  if (args.notify === true) {
    await server.notifyFanout({
      topics: [NOTES_WORLD_TOPIC],
      tables: ['notes'],
      label: 'writeNoteBody',
    });
  }
}
