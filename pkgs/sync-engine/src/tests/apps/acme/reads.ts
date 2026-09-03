/**
 * Domain reads for acme scenarios, built on the framework `rows` / `liveNote`
 * observations. Scenario tests stay on `run.apply` / `run.observe` — the run
 * API hands out no live database handles.
 */

import { expect } from 'bun:test';
import type { BoundObservation, JsonValue, Run } from '@pkgs/dst';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { SyncSurface } from '../../../sim/scenario';
import {
  clientIds,
  deviceId,
  liveNote,
  liveSpace,
  rows as rowsObs,
} from '../../../sim/scenario';

function rows<T extends Record<string, JsonValue>>(
  label: string,
  nodeId: string,
  statement: Parameters<SqlClient['query']>[0]
): BoundObservation<SyncSurface, T[]> {
  return rowsObs(label, nodeId, statement) as BoundObservation<
    SyncSurface,
    T[]
  >;
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
export function liveNotes(nodeId: string) {
  return rows<NoteRow>(
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
export function liveFolders(nodeId: string) {
  return rows<FolderRow>(
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
export function liveTags(nodeId: string) {
  return rows<TagRow>(
    'liveTags',
    nodeId,
    sql<TagRow>`
      SELECT id, label FROM tags WHERE deleted_at IS NULL ORDER BY id ASC
    `
  );
}

/** Live space open-session rows on `nodeId`, ordered by id. */
export function liveOpenSessions(nodeId: string) {
  return rows<OpenSessionRow>(
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
export function noteColumns(nodeId: string) {
  return rows<{ readonly name: string }>(
    'noteColumns',
    nodeId,
    sql<{ name: string }>`SELECT name FROM pragma_table_info('notes')`
  );
}

/** `color` on one note — only present on the extra-column schema variant. */
export function noteColor(nodeId: string, id: string) {
  return rows<{ readonly color: string | null }>(
    `noteColor:${id}`,
    nodeId,
    sql<{ color: string | null }>`
      SELECT color FROM notes WHERE id = ${id} AND deleted_at IS NULL
    `
  );
}

/** Local tables named `name` on `nodeId` — empty when the table is absent. */
export function localTable(nodeId: string, name: string) {
  return rows<{ readonly name: string }>(
    `localTable:${name}`,
    nodeId,
    sql<{ name: string }>`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${name}
    `
  );
}

/** True when `nodeId`'s local database has a table called `name`. */
export async function hasLocalTable(
  run: Run<SyncSurface>,
  nodeId: string,
  name: string
): Promise<boolean> {
  return (await run.observe(localTable(nodeId, name))).length === 1;
}

/** Narrow a raw observation value to a row object, or null. */
function asRow(value: JsonValue): Record<string, JsonValue> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value
    : null;
}

/**
 * Predicate for `untilAcme(run, liveNote(node, id), { pred: noteBodyIs(x) })` —
 * true once the row is present, live, and carries `body`.
 */
export function noteBodyIs(body: string) {
  return (value: JsonValue): boolean => {
    const row = asRow(value);
    return row?.['deletedAt'] === null && row['body'] === body;
  };
}

/**
 * Predicate for `neverAcme(run, liveNote(node, id), { pred: noteLive })` — true
 * once the row is present and not tombstoned, whatever its body.
 */
export const noteLive = (value: JsonValue): boolean =>
  asRow(value)?.['deletedAt'] === null;

/**
 * Predicate for `untilAcme(run, liveNote(node, id), { pred: noteNotLive })` —
 * true while the row is absent or tombstoned.
 */
export const noteNotLive = (value: JsonValue): boolean => !noteLive(value);

/** Predicate for `untilAcme(run, subscribedTopics(id), { pred: hasTopic(t) })`. */
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
  run: Run<SyncSurface>,
  nodeId: string
): Promise<string[]> {
  return (await run.observe(liveNotes(nodeId))).map((n) => n.id);
}

/** Tombstone stamp for one note, or `null` when the row is absent or live. */
export async function readNoteTombstoneAt(
  run: Run<SyncSurface>,
  nodeId: string,
  id: string
): Promise<string | null> {
  return (await run.observe(liveNote(nodeId, id)))?.deletedAt ?? null;
}

/** True when a note row is present and not tombstoned on `nodeId`. */
export async function isNoteLiveAt(
  run: Run<SyncSurface>,
  nodeId: string,
  id: string
): Promise<boolean> {
  const row = await run.observe(liveNote(nodeId, id));
  return row !== null && row.deletedAt === null;
}

/** Assert one live note body (and optional title) on `nodeId`. */
export async function expectLiveNoteAt(
  run: Run<SyncSurface>,
  nodeId: string,
  id: string,
  expected: { readonly body: string; readonly title?: string }
): Promise<void> {
  const row = await run.observe(liveNote(nodeId, id));
  expect(row).not.toBeNull();
  expect(row?.deletedAt).toBeNull();
  expect(row?.body).toBe(expected.body);
  if (expected.title !== undefined) {
    expect(row?.title).toBe(expected.title);
  }
}

/** Assert a note is not live on `nodeId` — absent or tombstoned. */
export async function expectNoteNotLiveAt(
  run: Run<SyncSurface>,
  nodeId: string,
  id: string
): Promise<void> {
  expect(await isNoteLiveAt(run, nodeId, id)).toBe(false);
}

/** Assert one client's live notes equal the server's (domain rows only). */
export async function expectNotesAgree(
  run: Run<SyncSurface>,
  clientId: string
): Promise<void> {
  const local = await run.observe(liveNotes(clientId));
  const server = await run.observe(liveNotes('server'));
  expect(local).toEqual(server);
}

/** Assert every named client's live notes equal the server's. */
export async function expectAllNotesAgree(
  run: Run<SyncSurface>,
  clientIds: readonly string[]
): Promise<void> {
  for (const id of clientIds) await expectNotesAgree(run, id);
}

/** Assert every client still live on the run agrees with the server. */
export async function expectEveryClientNotesAgree(
  run: Run<SyncSurface>
): Promise<void> {
  await expectAllNotesAgree(run, await run.observe(clientIds));
}

/** Assert this install holds exactly one live open session for `spaceId`. */
export async function expectOpenSessionAt(
  run: Run<SyncSurface>,
  clientId: string,
  spaceId: string
): Promise<void> {
  const device = await run.observe(deviceId(clientId));
  const sessions = await run.observe(liveOpenSessions(clientId));
  const owned = sessions.filter(
    (s) => s.spaceId === spaceId && s.deviceId === device
  );
  expect(owned.length).toBe(1);
}

/** Assert no live open-session row on `clientId` belongs to another device. */
export async function expectNoForeignOpenSessionsAt(
  run: Run<SyncSurface>,
  clientId: string
): Promise<void> {
  const device = await run.observe(deviceId(clientId));
  const sessions = await run.observe(liveOpenSessions(clientId));
  expect(sessions.filter((s) => s.deviceId !== device)).toEqual([]);
}

/** Assert one client's live folders equal the server's. */
export async function expectFoldersAgree(
  run: Run<SyncSurface>,
  clientId: string
): Promise<void> {
  const local = await run.observe(liveFolders(clientId));
  const server = await run.observe(liveFolders('server'));
  expect(local).toEqual(server);
}

/** True when a space row is present and not tombstoned on `nodeId`. */
export async function isSpaceLiveAt(
  run: Run<SyncSurface>,
  nodeId: string,
  id: string
): Promise<boolean> {
  const row = await run.observe(liveSpace(nodeId, id));
  return row !== null && row.deletedAt === null;
}

/** Assert one live space on `nodeId` (optional title / owner). */
export async function expectLiveSpaceAt(
  run: Run<SyncSurface>,
  nodeId: string,
  id: string,
  expected?: { readonly title?: string; readonly ownerId?: string }
): Promise<void> {
  const row = await run.observe(liveSpace(nodeId, id));
  expect(row).not.toBeNull();
  expect(row?.deletedAt).toBeNull();
  if (expected?.title !== undefined) expect(row?.title).toBe(expected.title);
  if (expected?.ownerId !== undefined) {
    expect(row?.ownerId).toBe(expected.ownerId);
  }
}

/** Assert a space is not live on `nodeId` — absent or tombstoned. */
export async function expectSpaceNotLiveAt(
  run: Run<SyncSurface>,
  nodeId: string,
  id: string
): Promise<void> {
  expect(await isSpaceLiveAt(run, nodeId, id)).toBe(false);
}

/** Live username on one profile row, or null when absent / empty. */
export function profileUsername(nodeId: string, profileId: string) {
  return rows<{ readonly username: string | null }>(
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
  run: Run<SyncSurface>,
  nodeId: string,
  profileId: string
): Promise<string | null> {
  const found = await run.observe(profileUsername(nodeId, profileId));
  const username = found[0]?.username;
  return typeof username === 'string' && username.length > 0 ? username : null;
}
