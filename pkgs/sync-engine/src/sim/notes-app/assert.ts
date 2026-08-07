import { expect } from 'bun:test';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

export type LiveNote = {
  readonly id: string;
  readonly folder_id: string | null;
  readonly title: string;
  readonly body: string;
  readonly owner_id: string;
};

export type LiveFolder = {
  readonly id: string;
  readonly title: string;
  readonly owner_id: string;
};

/** Live (non-tombstoned) notes ordered by id. */
export async function readLiveNotes(
  db: SqlClient
): Promise<readonly LiveNote[]> {
  return db.query(sql<LiveNote>`
    SELECT id, folder_id, title, body, owner_id
    FROM notes
    WHERE _deleted_at IS NULL
    ORDER BY id ASC
  `);
}

/** Live folders ordered by id. */
export async function readLiveFolders(
  db: SqlClient
): Promise<readonly LiveFolder[]> {
  return db.query(sql<LiveFolder>`
    SELECT id, title, owner_id
    FROM folders
    WHERE _deleted_at IS NULL
    ORDER BY id ASC
  `);
}

/** Tombstone timestamp for a note id, or null if missing / live. */
export async function readNoteTombstone(
  db: SqlClient,
  id: string
): Promise<string | null> {
  const rows = await db.query(sql<{ _deleted_at: string | null }>`
    SELECT _deleted_at FROM notes WHERE id = ${id}
  `);
  return rows[0]?._deleted_at ?? null;
}

/** Assert live notes on client match server (domain-only). */
export async function expectNotesMatchServer(
  clientDb: SqlClient,
  serverDb: SqlClient
): Promise<void> {
  const local = await readLiveNotes(clientDb);
  const server = await readLiveNotes(serverDb);
  expect(local).toEqual([...server]);
}

/** Assert live folders on client match server (domain-only). */
export async function expectFoldersMatchServer(
  clientDb: SqlClient,
  serverDb: SqlClient
): Promise<void> {
  const local = await readLiveFolders(clientDb);
  const server = await readLiveFolders(serverDb);
  expect(local).toEqual([...server]);
}

/** Assert one live note body (and optional title). */
export async function expectLiveNote(
  db: SqlClient,
  id: string,
  expected: { readonly body: string; readonly title?: string }
): Promise<void> {
  const rows = await db.query(sql<{ body: string; title: string }>`
    SELECT body, title FROM notes
    WHERE id = ${id} AND _deleted_at IS NULL
  `);
  expect(rows[0]?.body).toBe(expected.body);
  if (expected.title !== undefined) {
    expect(rows[0]?.title).toBe(expected.title);
  }
}

/** Assert note is not live (absent or tombstoned). */
export async function expectNoteNotLive(
  db: SqlClient,
  id: string
): Promise<void> {
  const rows = await db.query(sql<{ id: string }>`
    SELECT id FROM notes WHERE id = ${id} AND _deleted_at IS NULL
  `);
  expect(rows).toEqual([]);
}
