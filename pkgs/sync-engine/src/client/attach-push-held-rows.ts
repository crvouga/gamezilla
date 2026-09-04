import type { Topic } from '@pkgs/pubsub/interface';
import { ident, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { QueryDef, QueryRegistry, QueryRow } from '../queries/core/types';
import type { QueryChannelsCtx } from '../shared/push-payload';
import {
  subscribeTables,
  type TopicMap,
  type TopicMapCtx,
  topicsFromHeldRows,
} from '../shared/topic-map';

function isLiveRow(row: QueryRow): boolean {
  return row['deleted_at'] == null;
}

async function loadLiveRows(
  db: SqlClient,
  tables: readonly string[]
): Promise<Record<string, QueryRow[]>> {
  const out: Record<string, QueryRow[]> = {};
  for (const table of tables) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) continue;
    const rows = await db.query(sql<QueryRow>`
      SELECT * FROM ${ident(table)}
    `);
    const live = rows.filter(isLiveRow);
    if (live.length > 0) out[table] = live;
  }
  return out;
}

function collectSubscribeHydrates(
  active: readonly { readonly name: string }[],
  queryRegistry: QueryRegistry,
  subTables: ReadonlySet<string>
): string[] {
  const tableUnion = new Set<string>();
  for (const sub of active) {
    const query = queryRegistry[sub.name];
    for (const t of query?.hydrates ?? []) {
      if (subTables.has(t)) tableUnion.add(t);
    }
  }
  return [...tableUnion];
}

function entryTopicsForSub(args: {
  readonly query: QueryDef<unknown>;
  readonly params: Readonly<Record<string, unknown>>;
  readonly channelsCtx: QueryChannelsCtx;
  readonly defaultEntryChannel:
    | ((params: unknown, ctx: QueryChannelsCtx) => readonly Topic[])
    | undefined;
}): readonly Topic[] {
  if (args.query.entryChannel === false) return [];
  return (
    args.query.entryChannel?.(args.params as never, args.channelsCtx) ??
    args.defaultEntryChannel?.(args.params, args.channelsCtx) ??
    []
  );
}

function liveRowsForQuery(
  hydrates: readonly string[],
  subTables: ReadonlySet<string>,
  allLive: Readonly<Record<string, QueryRow[]>>
): Record<string, QueryRow[]> {
  const liveRowsByTable: Record<string, QueryRow[]> = {};
  for (const table of hydrates) {
    if (!subTables.has(table)) continue;
    const rows = allLive[table];
    if (rows !== undefined) liveRowsByTable[table] = rows;
  }
  return liveRowsByTable;
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

  const subTables = subscribeTables(args.topicMap);
  const hydrateTables = collectSubscribeHydrates(
    args.active,
    args.queryRegistry,
    subTables
  );
  const allLive =
    hydrateTables.length > 0 ? await loadLiveRows(args.db, hydrateTables) : {};

  for (const sub of args.active) {
    const query = args.queryRegistry[sub.name];
    if (query === undefined) {
      result.set(sub.scope, []);
      continue;
    }
    result.set(
      sub.scope,
      topicsFromHeldRows({
        topicMap: args.topicMap,
        liveRowsByTable: liveRowsForQuery(query.hydrates, subTables, allLive),
        entryTopics: entryTopicsForSub({
          query,
          params: sub.params,
          channelsCtx: args.channelsCtx,
          defaultEntryChannel: args.defaultEntryChannel,
        }),
        ctx: mapCtx,
      })
    );
  }
  return result;
}
