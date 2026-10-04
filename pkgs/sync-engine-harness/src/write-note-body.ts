import sql from '@pkgs/sql-shared/sql';

import type { HarnessServer } from './server';
import { NOTES_ALL_TOPIC } from './topics';

/**
 * Direct domain write bypassing mutations. Prefer `notify: true`.
 * When false, peers stay briefly stale until the reconcile tick.
 */
export async function writeNoteBody(
  server: HarnessServer,
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
      topics: [NOTES_ALL_TOPIC],
      tables: ['notes'],
      label: 'writeNoteBody',
    });
  }
}
