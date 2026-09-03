import type { Session } from '@pkgs/dst';
import { SqlClientImplPostgresMem } from '@pkgs/sql-client/postgres/impl-postgres-mem';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres/schema';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client/sqlite/impl-sqlite-mem';
import { reconcilePeer, SCHEMA_SERVER_ID, type SchemaPeer } from './peers';
import { schemaAt } from './schemas';

function seedOf(session: Session, index: number): number {
  return (
    Math.floor(session.ports.rng.fork(`sql:${index}`).next() * 0xffffffff) || 1
  );
}

export async function startServer(session: Session): Promise<SchemaPeer> {
  const client = SqlClientImplPostgresMem.open({
    seed: seedOf(session, 0),
    dbScope: createPostgresDbScope('public'),
  });
  await client.connect();
  const peer: SchemaPeer = {
    id: SCHEMA_SERVER_ID,
    kind: 'server',
    client,
    version: 0,
    planKinds: [],
  };
  await reconcilePeer(peer, schemaAt(0));
  return peer;
}

export async function startClient(
  session: Session,
  index: number
): Promise<SchemaPeer> {
  const id = `client-${index}`;
  const client = SqlClientImplSqliteMem.open({
    seed: seedOf(session, index + 1),
  });
  await client.connect();
  const peer: SchemaPeer = {
    id,
    kind: 'client',
    client,
    version: 0,
    planKinds: [],
  };
  await reconcilePeer(peer, schemaAt(0));
  return peer;
}

export async function disposePeers(surface: {
  readonly server: SchemaPeer;
  readonly clients: readonly SchemaPeer[];
}): Promise<void> {
  await surface.server.client.disconnect();
  await Promise.all(surface.clients.map((c) => c.client.disconnect()));
}
