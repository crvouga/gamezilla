import type { Topic } from '@pkgs/pubsub/interface';
import { ident, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { QueryRegistry, QueryRow } from '../queries/core/types';
import type { QueryChannelsCtx } from '../shared/push-payload';
import {
  type TopicMap,
  type TopicMapCtx,
  topicsFromHeldRows,
} from '../shared/topic-map';

function isLiveSpaceRow(row: QueryRow): boolean {
  if (row['deleted_at'] != null) return false;
  // Match product attach filter: ended spaces leave room subscribe set.
  if ('ended_at' in row && row['ended_at'] != null) return false;
  return true;
}

function isLiveRow(row: QueryRow): boolean {
  return row['deleted_at'] == null;
}

function isActorHost(row: QueryRow, actorId: string): boolean {
  for (const key of [
    'host_member_id',
    'host_account_id',
    'host_id',
    'owner_id',
  ] as const) {
    if (row[key] === actorId) return true;
  }
  return false;
}

async function loadLiveRows(
  db: SqlClient,
  tables: readonly string[],
  actorId: string
): Promise<Record<string, QueryRow[]>> {
  const out: Record<string, QueryRow[]> = {};
  let memberSpaceIds: Set<string> | null = null;
  if (tables.includes('spaces')) {
    const members = await db.query(sql<{ space_id: string }>`
      SELECT space_id FROM spaces_users
      WHERE user_id = ${actorId} AND deleted_at IS NULL
    `);
    memberSpaceIds = new Set(
      members.map((m) => m.space_id).filter((id) => id.length > 0)
    );
  }
  for (const table of tables) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) continue;
    const rows = await db.query(sql<QueryRow>`
      SELECT * FROM ${ident(table)}
    `);
    let live: QueryRow[];
    if (table === 'spaces') {
      // Match former membershipSpaceIds: live non-ended spaces where actor
      // is still a member or host (stale spaces rows after leave drop out).
      live = rows.filter(
        (r) =>
          isLiveSpaceRow(r) &&
          (memberSpaceIds?.has(String(r['id'] ?? '')) === true ||
            isActorHost(r, actorId))
      );
    } else if (table === 'spaces_users') {
      // Peer membership fanout must not keep room topics after the actor left.
      live = rows.filter((r) => isLiveRow(r) && r['user_id'] === actorId);
    } else if (table === 'notes' || table === 'folders' || table === 'tags') {
      // Domain rows may carry space_id for mutation publish; subscribe rooms
      // come from membership tables only.
      live = rows.filter(isLiveRow).map((r) => {
        if (r['space_id'] === undefined) return r;
        const { space_id: _spaceId, ...rest } = r;
        return rest;
      });
    } else {
      live = rows.filter(isLiveRow);
    }
    if (live.length > 0) out[table] = live;
  }
  return out;
}

export async function deriveScopeRowTopics(args: {
  readonly db: SqlClient;
  readonly queryRegistry: QueryRegistry;
  readonly topicMap: TopicMap | undefined;
  readonly defaultEntryChannel:
    | ((params: unknown, ctx: QueryChannelsCtx) => readonly Topic[])
    | undefined;
  readonly channelsCtx: QueryChannelsCtx;
  readonly active: readonly {
    readonly scope: string;
    readonly name: string;
    readonly params: Readonly<Record<string, unknown>>;
  }[];
}): Promise<Map<string, readonly Topic[]>> {
  const result = new Map<string, readonly Topic[]>();
  if (args.topicMap === undefined) return result;

  const mapCtx: TopicMapCtx = {
    actorId: args.channelsCtx.actorId,
    deviceId: '',
    accountId: null,
    isAnon: false,
  };

  const tableUnion = new Set<string>();
  for (const sub of args.active) {
    const query = args.queryRegistry[sub.name];
    for (const t of query?.hydrates ?? []) {
      tableUnion.add(t);
    }
  }
  const allLive =
    tableUnion.size > 0
      ? await loadLiveRows(args.db, [...tableUnion], args.channelsCtx.actorId)
      : {};

  for (const sub of args.active) {
    const query = args.queryRegistry[sub.name];
    if (query === undefined) {
      result.set(sub.scope, []);
      continue;
    }
    const entry =
      query.entryChannel === false
        ? []
        : (query.entryChannel?.(sub.params as never, args.channelsCtx) ??
          args.defaultEntryChannel?.(sub.params, args.channelsCtx) ??
          []);
    const liveRowsByTable: Record<string, QueryRow[]> = {};
    for (const table of query.hydrates) {
      const rows = allLive[table];
      if (rows !== undefined) liveRowsByTable[table] = rows;
    }
    result.set(
      sub.scope,
      topicsFromHeldRows({
        topicMap: args.topicMap,
        liveRowsByTable,
        entryTopics: entry,
        ctx: mapCtx,
      })
    );
  }
  return result;
}
