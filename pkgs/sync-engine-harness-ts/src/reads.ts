/**
 * Domain reads for example scenarios, built on the framework `rows` observation.
 * Scenario tests stay on `s.apply` / `s.observe` — the run API hands out no
 * live database handles.
 */

import { expect } from 'bun:test';
import type { JsonValue } from '@pkgs/harness-root-shared-ts/json';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';

import type { SyncHarness } from './scenario-system';
import { clientIds, deviceId, rows as rowsObs } from './sync-observations';

async function rows<T extends Record<string, JsonValue>>(
  s: SyncHarness,
  label: string,
  nodeId: string,
  statement: Parameters<SqlClient['query']>[0]
): Promise<T[]> {
  return (await rowsObs(s, label, nodeId, statement)) as T[];
}

export type LiveNoteRow = {
  readonly body: string;
  readonly title: string;
  readonly ownerId: string;
  readonly deletedAt: string | null;
};

/**
 * Note row on `nodeId` (`'server'` or a client id). `null` means the row is
 * absent; a non-null `deletedAt` means present but tombstoned.
 */
export async function liveNote(
  s: SyncHarness,
  nodeId: string,
  id: string
): Promise<LiveNoteRow | null> {
  const found = await rows<LiveNoteRow>(
    s,
    'liveNote',
    nodeId,
    sql<LiveNoteRow>`
      SELECT body, title, owner_id AS "ownerId", deleted_at AS "deletedAt"
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
  s: SyncHarness,
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
  s: SyncHarness,
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
  s: SyncHarness,
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

export type SpaceMemberRow = {
  readonly spaceId: string;
  readonly userId: string | null;
};

/**
 * Each live space on `nodeId` with its live members, ordered by space then
 * member (`userId` is null for a space nobody is in).
 */
export async function spaceMembers(
  s: SyncHarness,
  nodeId: string
): Promise<SpaceMemberRow[]> {
  return rows<SpaceMemberRow>(
    s,
    'spaceMembers',
    nodeId,
    sql<SpaceMemberRow>`
      SELECT sp.id AS "spaceId", su.user_id AS "userId"
      FROM spaces sp
      LEFT JOIN spaces_users su
        ON su.space_id = sp.id AND su.deleted_at IS NULL
      WHERE sp.deleted_at IS NULL
      ORDER BY sp.id ASC, su.user_id ASC
    `
  );
}

export type TagRow = {
  readonly id: string;
  readonly label: string;
};

/** Live tag rows on `nodeId` — only present on the extra-table variant. */
export async function liveTags(
  s: SyncHarness,
  nodeId: string
): Promise<TagRow[]> {
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
  s: SyncHarness,
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
  s: SyncHarness,
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
  s: SyncHarness,
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
  s: SyncHarness,
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
  s: Run<SyncHarness>,
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
  s: Run<SyncHarness>,
  nodeId: string
): Promise<string[]> {
  return (await s.read(liveNotes, nodeId)).map((n) => n.id);
}

/** Tombstone stamp for one note, or `null` when the row is absent or live. */
export async function readNoteTombstoneAt(
  s: Run<SyncHarness>,
  nodeId: string,
  id: string
): Promise<string | null> {
  return (await s.read(liveNote, nodeId, id))?.deletedAt ?? null;
}

/** True when a note row is present and not tombstoned on `nodeId`. */
export async function isNoteLiveAt(
  s: Run<SyncHarness>,
  nodeId: string,
  id: string
): Promise<boolean> {
  const row = await s.read(liveNote, nodeId, id);
  return row !== null && row.deletedAt === null;
}

/** Assert one live note body (and optional title) on `nodeId`. */
export async function expectLiveNoteAt(
  s: Run<SyncHarness>,
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
  s: Run<SyncHarness>,
  nodeId: string,
  id: string
): Promise<void> {
  expect(await isNoteLiveAt(s, nodeId, id)).toBe(false);
}

/** Assert one client's live notes equal the server's (domain rows only). */
export async function expectNotesAgree(
  s: Run<SyncHarness>,
  clientId: string
): Promise<void> {
  const local = await s.read(liveNotes, clientId);
  const server = await s.read(liveNotes, 'server');
  expect(local).toEqual(server);
}

/** Assert every named client's live notes equal the server's. */
export async function expectAllNotesAgree(
  s: Run<SyncHarness>,
  ids: readonly string[]
): Promise<void> {
  for (const id of ids) await expectNotesAgree(s, id);
}

/** Assert every client still live on the run agrees with the server. */
export async function expectEveryClientNotesAgree(
  s: Run<SyncHarness>
): Promise<void> {
  await expectAllNotesAgree(s, await s.read(clientIds));
}

/** Assert this install holds exactly one live open session for `spaceId`. */
export async function expectOpenSessionAt(
  s: Run<SyncHarness>,
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
  s: Run<SyncHarness>,
  clientId: string
): Promise<void> {
  const device = await s.read(deviceId, clientId);
  const sessions = await s.read(liveOpenSessions, clientId);
  expect(sessions.filter((s) => s.deviceId !== device)).toEqual([]);
}

/** Assert one client's live folders equal the server's. */
export async function expectFoldersAgree(
  s: Run<SyncHarness>,
  clientId: string
): Promise<void> {
  const local = await s.read(liveFolders, clientId);
  const server = await s.read(liveFolders, 'server');
  expect(local).toEqual(server);
}

/** True when a space row is present and not tombstoned on `nodeId`. */
export async function isSpaceLiveAt(
  s: Run<SyncHarness>,
  nodeId: string,
  id: string
): Promise<boolean> {
  const row = await s.read(liveSpace, nodeId, id);
  return row !== null && row.deletedAt === null;
}

/** Assert one live space on `nodeId` (optional title / owner). */
export async function expectLiveSpaceAt(
  s: Run<SyncHarness>,
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
  s: Run<SyncHarness>,
  nodeId: string,
  id: string
): Promise<void> {
  expect(await isSpaceLiveAt(s, nodeId, id)).toBe(false);
}

/** Live username on one profile row, or null when absent / empty. */
export async function profileUsername(
  s: SyncHarness,
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
  s: Run<SyncHarness>,
  nodeId: string,
  profileId: string
): Promise<string | null> {
  const found = await s.read(profileUsername, nodeId, profileId);
  const username = found[0]?.username;
  return typeof username === 'string' && username.length > 0 ? username : null;
}

/** Every live note's body on each of `nodeIds`, keyed `node/noteId`. */
export async function noteBodies(
  s: SyncHarness,
  nodeIds: readonly string[]
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const nodeId of nodeIds) {
    for (const note of await liveNotes(s, nodeId)) {
      out[`${nodeId}/${note.id}`] = note.body;
    }
  }
  return out;
}

/**
 * A fresh watcher for `s.never((s) => noteBodies(…), { pred: goesBack() })`:
 * true once any key shows a body it showed before and has since moved away
 * from. `changes()` counts the moves it saw, so a caller can tell a watch
 * that saw nothing arrive from one that saw every note move forward;
 * `wentBack()` says which note went back, and to what.
 */
export function goesBack(): ((seen: Record<string, string>) => boolean) & {
  readonly changes: () => number;
  readonly wentBack: () => string | null;
} {
  const history = new Map<string, string[]>();
  let moves = 0;
  let back: string | null = null;
  const pred = (seen: Record<string, string>): boolean => {
    for (const [key, body] of Object.entries(seen)) {
      const shown = history.get(key) ?? [];
      const last = shown[shown.length - 1];
      if (last === body) continue;
      if (shown.includes(body)) {
        back = `${key} went back from "${String(last)}" to "${body}"`;
        return true;
      }
      if (last !== undefined) moves += 1;
      history.set(key, [...shown, body]);
    }
    return false;
  };
  return Object.assign(pred, { changes: () => moves, wentBack: () => back });
}
