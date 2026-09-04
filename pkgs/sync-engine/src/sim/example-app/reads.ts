/**
 * Domain reads for example scenarios, built on the framework `rows` observation.
 * Scenario tests stay on `s.apply` / `s.observe` — the run API hands out no
 * live database handles.
 */

import { expect } from 'bun:test';
import type { JsonValue, Run } from '@pkgs/sim';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { SyncSim } from '../scenario';
import { clientIds, deviceId, rows as rowsObs } from '../scenario';

async function rows<T extends Record<string, JsonValue>>(
  s: SyncSim,
  label: string,
  nodeId: string,
  statement: Parameters<SqlClient['query']>[0]
): Promise<T[]> {
  return (await rowsObs(s, label, nodeId, statement)) as T[];
}

export type LiveNoteRow = {
  readonly body: string;
  readonly title: string;
  readonly deletedAt: string | null;
};

/**
 * Note row on `nodeId` (`'server'` or a client id). `null` means the row is
 * absent; a non-null `deletedAt` means present but tombstoned.
 */
export async function liveNote(
  s: SyncSim,
  nodeId: string,
  id: string
): Promise<LiveNoteRow | null> {
  const found = await rows<LiveNoteRow>(
    s,
    'liveNote',
    nodeId,
    sql<LiveNoteRow>`
      SELECT body, title, deleted_at AS "deletedAt"
      FROM notes
      WHERE id = ${id}
    `
  );
  return found[0] ?? null;
}

export type LiveSpaceRow = {
  readonly title: string;
  readonly ownerId: string;
  readonly deletedAt: string | null;
};

/** Space row on `nodeId` — same absent / tombstoned rules as {@link liveNote}. */
export async function liveSpace(
  s: SyncSim,
  nodeId: string,
  id: string
): Promise<LiveSpaceRow | null> {
  const found = await rows<LiveSpaceRow>(
    s,
    'liveSpace',
    nodeId,
    sql<LiveSpaceRow>`
      SELECT title, owner_id AS "ownerId", deleted_at AS "deletedAt"
      FROM spaces
      WHERE id = ${id}
    `
  );
  return found[0] ?? null;
}

export type NoteRow = {
  readonly id: string;
  readonly folderId: string | null;
  readonly title: string;
  readonly body: string;
  readonly ownerId: string;
};

export type FolderRow = {
  readonly id: string;
  readonly title: string;
  readonly ownerId: string;
};

export type OpenSessionRow = {
  readonly id: string;
  readonly spaceId: string;
  readonly deviceId: string;
};

/** Live (non-tombstoned) notes on `nodeId`, ordered by id. */
export async function liveNotes(
  s: SyncSim,
  nodeId: string
): Promise<NoteRow[]> {
  return rows<NoteRow>(
    s,
    'liveNotes',
    nodeId,
    sql<NoteRow>`
      SELECT id, folder_id AS "folderId", title, body, owner_id AS "ownerId"
      FROM notes
      WHERE deleted_at IS NULL
      ORDER BY id ASC
    `
  );
}

/** Live folders on `nodeId`, ordered by id. */
export async function liveFolders(
  s: SyncSim,
  nodeId: string
): Promise<FolderRow[]> {
  return rows<FolderRow>(
    s,
    'liveFolders',
    nodeId,
    sql<FolderRow>`
      SELECT id, title, owner_id AS "ownerId"
      FROM folders
      WHERE deleted_at IS NULL
      ORDER BY id ASC
    `
  );
}

export type TagRow = {
  readonly id: string;
  readonly label: string;
};

/** Live tag rows on `nodeId` — only present on the extra-table variant. */
export async function liveTags(s: SyncSim, nodeId: string): Promise<TagRow[]> {
  return rows<TagRow>(
    s,
    'liveTags',
    nodeId,
    sql<TagRow>`
      SELECT id, label FROM tags WHERE deleted_at IS NULL ORDER BY id ASC
    `
  );
}

/** Live space open-session rows on `nodeId`, ordered by id. */
export async function liveOpenSessions(
  s: SyncSim,
  nodeId: string
): Promise<OpenSessionRow[]> {
  return rows<OpenSessionRow>(
    s,
    'liveOpenSessions',
    nodeId,
    sql<OpenSessionRow>`
      SELECT id, space_id AS "spaceId", device_id AS "deviceId"
      FROM spaces_open_sessions
      WHERE deleted_at IS NULL
      ORDER BY id ASC
    `
  );
}

/** Column names of the local `notes` table on `nodeId`. */
export async function noteColumns(
  s: SyncSim,
  nodeId: string
): Promise<{ readonly name: string }[]> {
  return rows<{ readonly name: string }>(
    s,
    'noteColumns',
    nodeId,
    sql<{ name: string }>`SELECT name FROM pragma_table_info('notes')`
  );
}

/** `color` on one note — only present on the extra-column schema variant. */
export async function noteColor(
  s: SyncSim,
  nodeId: string,
  id: string
): Promise<{ readonly color: string | null }[]> {
  return rows<{ readonly color: string | null }>(
    s,
    `noteColor:${id}`,
    nodeId,
    sql<{ color: string | null }>`
      SELECT color FROM notes WHERE id = ${id} AND deleted_at IS NULL
    `
  );
}

/** Local tables named `name` on `nodeId` — empty when the table is absent. */
export async function localTable(
  s: SyncSim,
  nodeId: string,
  name: string
): Promise<{ readonly name: string }[]> {
  return rows<{ readonly name: string }>(
    s,
    `localTable:${name}`,
    nodeId,
    sql<{ name: string }>`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${name}
    `
  );
}

/** True when `nodeId`'s local database has a table called `name`. */
export async function hasLocalTable(
  s: Run<SyncSim>,
  nodeId: string,
  name: string
): Promise<boolean> {
  return (await s.read(localTable, nodeId, name)).length === 1;
}

/** Narrow a raw observation value to a row object, or null. */
function asRow(value: JsonValue): Record<string, JsonValue> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value
    : null;
}

/**
 * Predicate for `untilExample(s, (s) => liveNote(s, node, id), { pred: noteBodyIs(x) })`
 * — true once the row is present, live, and carries `body`.
 */
export function noteBodyIs(body: string) {
  return (value: JsonValue): boolean => {
    const row = asRow(value);
    return row?.['deletedAt'] === null && row['body'] === body;
  };
}

/**
 * Predicate for `neverExample(s, (s) => liveNote(s, node, id), { pred: noteLive })`
 * — true once the row is present and not tombstoned, whatever its body.
 */
export const noteLive = (value: JsonValue): boolean =>
  asRow(value)?.['deletedAt'] === null;

/**
 * Predicate for `untilExample(s, (s) => liveNote(s, node, id), { pred: noteNotLive })`
 * — true while the row is absent or tombstoned.
 */
export const noteNotLive = (value: JsonValue): boolean => !noteLive(value);

/** Predicate for `untilExample(s, (s) => subscribedTopics(s, id), { pred: hasTopic(t) })`. */
export function hasTopic(topic: string) {
  return (value: JsonValue): boolean =>
    Array.isArray(value) && value.includes(topic);
}

/** Negation of {@link hasTopic} — the topic handler is gone. */
export function lacksTopic(topic: string) {
  return (value: JsonValue): boolean =>
    Array.isArray(value) && !value.includes(topic);
}

/** Live note ids on `nodeId`. */
export async function readLiveNoteIds(
  s: Run<SyncSim>,
  nodeId: string
): Promise<string[]> {
  return (await s.read(liveNotes, nodeId)).map((n) => n.id);
}

/** Tombstone stamp for one note, or `null` when the row is absent or live. */
export async function readNoteTombstoneAt(
  s: Run<SyncSim>,
  nodeId: string,
  id: string
): Promise<string | null> {
  return (await s.read(liveNote, nodeId, id))?.deletedAt ?? null;
}

/** True when a note row is present and not tombstoned on `nodeId`. */
export async function isNoteLiveAt(
  s: Run<SyncSim>,
  nodeId: string,
  id: string
): Promise<boolean> {
  const row = await s.read(liveNote, nodeId, id);
  return row !== null && row.deletedAt === null;
}

/** Assert one live note body (and optional title) on `nodeId`. */
export async function expectLiveNoteAt(
  s: Run<SyncSim>,
  nodeId: string,
  id: string,
  expected: { readonly body: string; readonly title?: string }
): Promise<void> {
  const row = await s.read(liveNote, nodeId, id);
  expect(row).not.toBeNull();
  expect(row?.deletedAt).toBeNull();
  expect(row?.body).toBe(expected.body);
  if (expected.title !== undefined) {
    expect(row?.title).toBe(expected.title);
  }
}

/** Assert a note is not live on `nodeId` — absent or tombstoned. */
export async function expectNoteNotLiveAt(
  s: Run<SyncSim>,
  nodeId: string,
  id: string
): Promise<void> {
  expect(await isNoteLiveAt(s, nodeId, id)).toBe(false);
}

/** Assert one client's live notes equal the server's (domain rows only). */
export async function expectNotesAgree(
  s: Run<SyncSim>,
  clientId: string
): Promise<void> {
  const local = await s.read(liveNotes, clientId);
  const server = await s.read(liveNotes, 'server');
  expect(local).toEqual(server);
}

/** Assert every named client's live notes equal the server's. */
export async function expectAllNotesAgree(
  s: Run<SyncSim>,
  ids: readonly string[]
): Promise<void> {
  for (const id of ids) await expectNotesAgree(s, id);
}

/** Assert every client still live on the run agrees with the server. */
export async function expectEveryClientNotesAgree(
  s: Run<SyncSim>
): Promise<void> {
  await expectAllNotesAgree(s, await s.read(clientIds));
}

/** Assert this install holds exactly one live open session for `spaceId`. */
export async function expectOpenSessionAt(
  s: Run<SyncSim>,
  clientId: string,
  spaceId: string
): Promise<void> {
  const device = await s.read(deviceId, clientId);
  const sessions = await s.read(liveOpenSessions, clientId);
  const owned = sessions.filter(
    (s) => s.spaceId === spaceId && s.deviceId === device
  );
  expect(owned.length).toBe(1);
}

/** Assert no live open-session row on `clientId` belongs to another device. */
export async function expectNoForeignOpenSessionsAt(
  s: Run<SyncSim>,
  clientId: string
): Promise<void> {
  const device = await s.read(deviceId, clientId);
  const sessions = await s.read(liveOpenSessions, clientId);
  expect(sessions.filter((s) => s.deviceId !== device)).toEqual([]);
}

/** Assert one client's live folders equal the server's. */
export async function expectFoldersAgree(
  s: Run<SyncSim>,
  clientId: string
): Promise<void> {
  const local = await s.read(liveFolders, clientId);
  const server = await s.read(liveFolders, 'server');
  expect(local).toEqual(server);
}

/** True when a space row is present and not tombstoned on `nodeId`. */
export async function isSpaceLiveAt(
  s: Run<SyncSim>,
  nodeId: string,
  id: string
): Promise<boolean> {
  const row = await s.read(liveSpace, nodeId, id);
  return row !== null && row.deletedAt === null;
}

/** Assert one live space on `nodeId` (optional title / owner). */
export async function expectLiveSpaceAt(
  s: Run<SyncSim>,
  nodeId: string,
  id: string,
  expected?: { readonly title?: string; readonly ownerId?: string }
): Promise<void> {
  const row = await s.read(liveSpace, nodeId, id);
  expect(row).not.toBeNull();
  expect(row?.deletedAt).toBeNull();
  if (expected?.title !== undefined) expect(row?.title).toBe(expected.title);
  if (expected?.ownerId !== undefined) {
    expect(row?.ownerId).toBe(expected.ownerId);
  }
}

/** Assert a space is not live on `nodeId` — absent or tombstoned. */
export async function expectSpaceNotLiveAt(
  s: Run<SyncSim>,
  nodeId: string,
  id: string
): Promise<void> {
  expect(await isSpaceLiveAt(s, nodeId, id)).toBe(false);
}

/** Live username on one profile row, or null when absent / empty. */
export async function profileUsername(
  s: SyncSim,
  nodeId: string,
  profileId: string
): Promise<{ readonly username: string | null }[]> {
  return rows<{ readonly username: string | null }>(
    s,
    `profileUsername:${profileId}`,
    nodeId,
    sql<{ username: string | null }>`
      SELECT username FROM profile
      WHERE id = ${profileId} AND deleted_at IS NULL
      LIMIT 1
    `
  );
}

/** Username for a profile on `nodeId`, or null when absent / empty. */
export async function readProfileUsernameAt(
  s: Run<SyncSim>,
  nodeId: string,
  profileId: string
): Promise<string | null> {
  const found = await s.read(profileUsername, nodeId, profileId);
  const username = found[0]?.username;
  return typeof username === 'string' && username.length > 0 ? username : null;
}
