import { sql } from '@pkgs/sql';

import type { HarnessServer } from '../server';
import { NOTES_ALL_TOPIC } from './shared/topics';

/**
 * Direct catalog INSERT bypassing mutations (seed-shaped write).
 * Prefer `notify: true`. When false, clients that already empty-hydrated
 * stay briefly stale until the reconcile tick — same footgun shape as a
 * chess puzzle seed without wake.
 */
export async function insertCatalogNote(
  server: HarnessServer,
  args: {
    readonly id: string;
    readonly body: string;
    readonly title?: string;
    readonly notify?: boolean;
  }
): Promise<void> {
  const title = args.title ?? '';
  const ownerId = 'seed';
  await server.db.run(sql`
    INSERT INTO notes (id, folder_id, title, body, owner_id)
    VALUES (${args.id}, NULL, ${title}, ${args.body}, ${ownerId})
  `);
  if (args.notify === true) {
    await server.notifyFanout({
      topics: [NOTES_ALL_TOPIC],
      tables: ['notes'],
      label: 'insertCatalogNote',
    });
  }
}
