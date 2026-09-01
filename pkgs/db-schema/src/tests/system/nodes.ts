import { defineNodeKind } from '@pkgs/determinism';
import { SqlClientImplPostgresMem } from '@pkgs/sql-client/postgres/impl-postgres-mem';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres/schema';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client/sqlite/impl-sqlite-mem';
import { reconcilePeer, type SchemaPeer, type SchemaSystem } from './peers';
import { schemaAt } from './schemas';

export const SCHEMA_SERVER_KIND = 'schema.server';
export const SCHEMA_CLIENT_KIND = 'schema.client';

function seedOf(seed: bigint, index: number): number {
  return (Number(seed & 0xffffffffn) || 1) + index;
}

/** Postgres-mem server peer, reconciled to schema v0 at boot. */
export const schemaServerNode = defineNodeKind<
  SchemaPeer,
  SchemaPeer,
  SchemaSystem
>({
  id: SCHEMA_SERVER_KIND,
  boot: async (ctx) => {
    const client = SqlClientImplPostgresMem.open({
      seed: seedOf(ctx.deps.seed, 0),
      dbScope: createPostgresDbScope('public'),
    });
    await client.connect();
    const peer: SchemaPeer = {
      id: ctx.nodeId,
      kind: 'server',
      client,
      version: 0,
      planKinds: [],
    };
    await reconcilePeer(peer, schemaAt(0));
    ctx.system.server = peer;
    return peer;
  },
  dispose: async (peer) => {
    await peer.client.disconnect();
  },
});

/** Sqlite-mem client peer, reconciled to schema v0 at boot. */
export const schemaClientNode = defineNodeKind<
  SchemaPeer,
  SchemaPeer,
  SchemaSystem
>({
  id: SCHEMA_CLIENT_KIND,
  boot: async (ctx) => {
    const client = SqlClientImplSqliteMem.open({
      seed: seedOf(ctx.deps.seed, ctx.index + 1),
    });
    await client.connect();
    const peer: SchemaPeer = {
      id: ctx.nodeId,
      kind: 'client',
      client,
      version: 0,
      planKinds: [],
    };
    await reconcilePeer(peer, schemaAt(0));
    ctx.system.clients.push(peer);
    return peer;
  },
  dispose: async (peer) => {
    await peer.client.disconnect();
  },
});
