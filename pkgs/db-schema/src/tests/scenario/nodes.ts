import { knob, node } from '@pkgs/dst';
import { SqlClientImplPostgresMem } from '@pkgs/sql-client/postgres/impl-postgres-mem';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres/schema';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client/sqlite/impl-sqlite-mem';
import fc from 'fast-check';
import { reconcilePeer, type SchemaPeer } from './peers';
import { schemaAt } from './schemas';

export const SCHEMA_CLIENT_COUNT = knob(2, fc.integer({ min: 1, max: 3 }));

function seedOf(seed: bigint, index: number): number {
  return (Number(seed & 0xffffffffn) || 1) + index;
}

/** Postgres-mem server peer, reconciled to schema v0 at boot. */
export const schemaServerNode = node({
  start: async (ctx) => {
    const client = SqlClientImplPostgresMem.open({
      seed: seedOf(ctx.ports.seed, 0),
      dbScope: createPostgresDbScope('public'),
    });
    await client.connect();
    const peer: SchemaPeer = {
      id: ctx.id,
      kind: 'server',
      client,
      version: 0,
      planKinds: [],
    };
    await reconcilePeer(peer, schemaAt(0));
    return peer;
  },
  stop: async (peer) => {
    await peer.client.disconnect();
  },
});

/** Sqlite-mem client peer, reconciled to schema v0 at boot. */
export const schemaClientNode = node({
  start: async (ctx) => {
    const client = SqlClientImplSqliteMem.open({
      seed: seedOf(ctx.ports.seed, ctx.index + 1),
    });
    await client.connect();
    const peer: SchemaPeer = {
      id: ctx.id,
      kind: 'client',
      client,
      version: 0,
      planKinds: [],
    };
    await reconcilePeer(peer, schemaAt(0));
    return peer;
  },
  stop: async (peer) => {
    await peer.client.disconnect();
  },
});
