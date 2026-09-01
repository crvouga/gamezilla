import { createHash } from 'node:crypto';
import type { PostgresSqlClient, SqlClient } from '@pkgs/sql-client/interface';
import type { Schema } from '../../core/types';
import { postgres } from '../../postgres/driver';
import { sqlite } from '../../sqlite/driver';
import { type SchemaVersion, schemaAt } from './schemas';

export const SCHEMA_SERVER_ID = 'server';

export type PeerKind = 'server' | 'client';

export type SchemaPeer = {
  readonly id: string;
  readonly kind: PeerKind;
  readonly client: SqlClient;
  version: SchemaVersion;
  readonly planKinds: string[];
};

export type SchemaSystem = {
  server: SchemaPeer | null;
  readonly clients: SchemaPeer[];
};

export function createSchemaSystem(): SchemaSystem {
  return { server: null, clients: [] };
}

export function requireServer(system: SchemaSystem): SchemaPeer {
  if (system.server === null) {
    throw new Error('db-schema DST: schema.server node is not booted');
  }
  return system.server;
}

export function resolvePeer(system: SchemaSystem, id: string): SchemaPeer {
  const server = requireServer(system);
  if (id === server.id) return server;
  const client = system.clients.find((c) => c.id === id);
  if (client === undefined) {
    throw new Error(`db-schema DST: no peer ${id}`);
  }
  return client;
}

export async function reconcilePeer(
  peer: SchemaPeer,
  schema: Schema
): Promise<void> {
  if (peer.kind === 'server') {
    await postgres(schema, peer.client as PostgresSqlClient, {
      skipAdvisoryLock: true,
    }).reconcile();
    return;
  }
  await sqlite(schema, peer.client).reconcile();
}

export async function advancePeer(
  peer: SchemaPeer,
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

export function planKindHash(peer: SchemaPeer): string {
  return createHash('sha256').update(peer.planKinds.join('|')).digest('hex');
}
