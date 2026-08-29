import { createHash } from 'node:crypto';
import { raw } from '@pkgs/sql';
import type { PostgresSqlClient, SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplPostgresMem } from '@pkgs/sql-client/postgres/impl-postgres-mem';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres/schema';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client/sqlite/impl-sqlite-mem';
import { defineTable } from '../../core/define-table';
import { registerTables } from '../../core/register-tables';
import type { Schema } from '../../core/types';
import { postgres } from '../../postgres/driver';
import { sqlite } from '../../sqlite/driver';

export type SchemaVersion = 0 | 1 | 2 | 3 | 4;

/** Compatible expand/contract chain for DST. */
export function schemaAt(version: SchemaVersion): Schema {
  if (version === 0) {
    return registerTables([
      defineTable({
        domain: 'items',
        name: 'items',
        columns: { title: 'text' },
      }),
    ]);
  }
  if (version === 1) {
    return registerTables([
      defineTable({
        domain: 'items',
        name: 'items',
        columns: { title: 'text', body: 'text' },
        indexes: ['title'],
      }),
    ]);
  }
  if (version === 2) {
    return registerTables([
      defineTable({
        domain: 'items',
        name: 'items',
        columns: {
          body: 'text',
          display_title: { type: 'text', renamedFrom: 'title' },
        },
        deprecations: [['title', 'renamed to display_title']],
        indexes: ['body'],
      }),
    ]);
  }
  if (version === 3) {
    return registerTables([
      defineTable({
        domain: 'items',
        name: 'items',
        columns: {
          body: 'text',
          display_title: 'text',
          label: { type: 'text', backfill: { from: 'display_title' } },
        },
        deprecations: [['title', 'renamed to display_title']],
        indexes: ['body'],
      }),
    ]);
  }
  return registerTables([
    defineTable({
      domain: 'items',
      name: 'items',
      columns: {
        body: 'text',
        display_title: 'text',
        label: 'text',
        score: 'integer',
      },
      deprecations: [['title', 'renamed to display_title']],
      indexes: ['body', 'score'],
    }),
  ]);
}

export type PeerKind = 'server' | 'client';

export type Peer = {
  readonly id: string;
  readonly kind: PeerKind;
  readonly client: SqlClient;
  version: SchemaVersion;
  planKinds: string[];
};

export type SchemaWorld = {
  readonly seed: number;
  readonly server: Peer;
  readonly clients: Peer[];
};

export async function openWorld(args: {
  readonly seed: number;
  readonly clientCount: number;
}): Promise<SchemaWorld> {
  const serverClient = SqlClientImplPostgresMem.open({
    seed: args.seed,
    dbScope: createPostgresDbScope('public'),
  });
  await serverClient.connect();
  const server: Peer = {
    id: 'server',
    kind: 'server',
    client: serverClient,
    version: 0,
    planKinds: [],
  };
  await reconcilePeer(server, schemaAt(0));

  const clients: Peer[] = [];
  for (let i = 0; i < args.clientCount; i++) {
    const c = SqlClientImplSqliteMem.open({ seed: args.seed + i + 1 });
    await c.connect();
    const peer: Peer = {
      id: `client-${i}`,
      kind: 'client',
      client: c,
      version: 0,
      planKinds: [],
    };
    await reconcilePeer(peer, schemaAt(0));
    clients.push(peer);
  }
  return { seed: args.seed, server, clients };
}

export async function closeWorld(world: SchemaWorld): Promise<void> {
  await world.server.client.disconnect();
  for (const c of world.clients) {
    await c.client.disconnect();
  }
}

export async function reconcilePeer(peer: Peer, schema: Schema): Promise<void> {
  if (peer.kind === 'server') {
    await postgres(schema, peer.client as PostgresSqlClient, {
      skipAdvisoryLock: true,
    }).reconcile();
  } else {
    await sqlite(schema, peer.client).reconcile();
  }
}

export async function advancePeer(
  peer: Peer,
  to: SchemaVersion
): Promise<void> {
  if (to < peer.version) {
    throw new Error(
      `schema versions only advance (have ${peer.version}, want ${to})`
    );
  }
  for (let v = peer.version + 1; v <= to; v++) {
    await reconcilePeer(peer, schemaAt(v as SchemaVersion));
    peer.version = v as SchemaVersion;
    peer.planKinds.push(`v${v}`);
  }
}

export function liveColumns(version: SchemaVersion): readonly string[] {
  const table = schemaAt(version).snapshot().tables['items']!;
  return Object.keys(table).sort();
}

export function planKindHash(peer: Peer): string {
  return createHash('sha256').update(peer.planKinds.join('|')).digest('hex');
}

export async function assertServerHasLiveColumns(
  world: SchemaWorld
): Promise<void> {
  for (const col of liveColumns(world.server.version)) {
    const found = await world.server.client.query<{ column_name: string }>(
      raw(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'items' AND column_name = '${col.replace(/'/g, "''")}'`
      )
    );
    if (found.length === 0) {
      throw new Error(
        `server lost live column '${col}' at version ${world.server.version}`
      );
    }
  }
}

export async function assertClientAlignedWithServer(
  client: Peer,
  server: Peer
): Promise<void> {
  if (client.version > server.version) {
    throw new Error(
      `client ${client.id}@v${client.version} ahead of server@v${server.version}`
    );
  }
  if (client.version === server.version) {
    const a = liveColumns(client.version).join(',');
    const b = liveColumns(server.version).join(',');
    if (a !== b) {
      throw new Error(
        `live column mismatch at v${client.version}: client=${a} server=${b}`
      );
    }
  }
  // Lagging clients remain valid: they can advance to server version.
  if (client.version < server.version) {
    const to = server.version;
    await advancePeer(client, to);
    const a = liveColumns(client.version).join(',');
    const b = liveColumns(server.version).join(',');
    if (a !== b) {
      throw new Error(`after catch-up mismatch: client=${a} server=${b}`);
    }
  }
}

/** Forbidden schema: type change in place — must refuse on server. */
export function forbiddenSchema(): Schema {
  return registerTables([
    defineTable({
      domain: 'items',
      name: 'items',
      columns: { title: 'integer' },
    }),
  ]);
}
