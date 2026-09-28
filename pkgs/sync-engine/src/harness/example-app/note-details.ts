/**
 * Details a newer app version gives a note: a colour (`notes.color`, the
 * extra-column variant) and tags (the `tags` table of the extra-table
 * variant). No mutation the baseline server accepts carries them, so a
 * version that has them keeps them on the device (or, for the team, on the
 * server once it runs that version) and the sync engine must not lose them.
 */

import { defineAction } from '@pkgs/harness';
import { sql } from '@pkgs/sql';

import { rows } from '../scenario';
import { requireClient } from '../scenario/regression-support';
import type { SyncHarness } from '../scenario/system';

function dbOf(s: SyncHarness, nodeId: string) {
  return nodeId === 'server' ? s.server.db : requireClient(s, nodeId).db;
}

/** `s.apply(colourNote, 'alice', 'n1', 'green')` — on a colour version. */
export const colourNote = defineAction({
  name: 'colourNote',
  act: async (
    s: SyncHarness,
    nodeId: string,
    noteId: string,
    colour: string
  ) => {
    await dbOf(s, nodeId).run(sql`
      UPDATE notes SET color = ${colour} WHERE id = ${noteId}
    `);
  },
});

/** `s.apply(tagNote, 'alice', 'n1', 'shopping')` — on a tagging version. */
export const tagNote = defineAction({
  name: 'tagNote',
  act: async (
    s: SyncHarness,
    nodeId: string,
    noteId: string,
    label: string
  ) => {
    await dbOf(s, nodeId).run(sql`
      INSERT INTO tags (id, label, owner_id)
      VALUES (${`${noteId}:${label}`}, ${label}, ${nodeId})
      ON CONFLICT (id) DO UPDATE SET label = excluded.label, deleted_at = NULL
    `);
  },
});

/** Live tag labels on one note (`nodeId` must be on a tagging version). */
export async function noteTags(
  s: SyncHarness,
  nodeId: string,
  noteId: string
): Promise<string[]> {
  const found = (await rows(
    s,
    `noteTags:${noteId}`,
    nodeId,
    sql<{ label: string }>`
      SELECT label FROM tags
      WHERE id LIKE ${`${noteId}:%`} AND deleted_at IS NULL
      ORDER BY label ASC
    `
  )) as { readonly label: string }[];
  return found.map((row) => row.label);
}
