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
    WHERE deleted_at IS NULL
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
    WHERE deleted_at IS NULL
    ORDER BY id ASC
  `);
}

/** Tombstone timestamp for a note id, or null if missing / live. */
export async function readNoteTombstone(
  db: SqlClient,
  id: string
): Promise<string | null> {
  const rows = await db.query(sql<{ deleted_at: string | null }>`
    SELECT deleted_at FROM notes WHERE id = ${id}
  `);
  return rows[0]?.deleted_at ?? null;
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
    WHERE id = ${id} AND deleted_at IS NULL
  `);
  expect(rows[0]?.body).toBe(expected.body);
  if (expected.title !== undefined) {
    expect(rows[0]?.title).toBe(expected.title);
  }
}

/** True when note id is live (present and not tombstoned). */
export async function isLiveNote(db: SqlClient, id: string): Promise<boolean> {
  const rows = await db.query(sql<{ id: string }>`
    SELECT id FROM notes WHERE id = ${id} AND deleted_at IS NULL
  `);
  return rows.length > 0;
}

/** Assert note is not live (absent or tombstoned). */
export async function expectNoteNotLive(
  db: SqlClient,
  id: string
): Promise<void> {
  expect(await isLiveNote(db, id)).toBe(false);
}

export type LiveOpenSession = {
  readonly id: string;
  readonly space_id: string;
  readonly device_id: string;
};

/** Live (non-tombstoned) open sessions ordered by id. */
export async function readLiveOpenSessions(
  db: SqlClient
): Promise<readonly LiveOpenSession[]> {
  return db.query(sql<LiveOpenSession>`
    SELECT id, space_id, device_id
    FROM spaces_open_sessions
    WHERE deleted_at IS NULL
    ORDER BY id ASC
  `);
}

/** Assert this install has a live open session for `spaceId`. */
export async function expectOpenSession(
  db: SqlClient,
  deviceId: string,
  spaceId: string
): Promise<void> {
  const rows = await db.query(sql<{ id: string }>`
    SELECT id FROM spaces_open_sessions
    WHERE space_id = ${spaceId}
      AND device_id = ${deviceId}
      AND deleted_at IS NULL
  `);
  expect(rows.length).toBe(1);
}

/** Assert no live open-session rows owned by a foreign device. */
export async function expectNoForeignOpenSessions(
  db: SqlClient,
  localDeviceId: string
): Promise<void> {
  const rows = await db.query(sql<{ device_id: string }>`
    SELECT device_id FROM spaces_open_sessions
    WHERE deleted_at IS NULL AND device_id != ${localDeviceId}
  `);
  expect(rows).toEqual([]);
}

/** Live username for a profile id, or null if missing / empty. */
export async function readProfileUsername(
  db: SqlClient,
  profileId: string
): Promise<string | null> {
  const rows = await db.query(sql<{ username: string | null }>`
    SELECT username FROM profile
    WHERE id = ${profileId} AND deleted_at IS NULL
    LIMIT 1
  `);
  const username = rows[0]?.username;
  return typeof username === 'string' && username.length > 0 ? username : null;
}
