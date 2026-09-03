import type { Session } from '@pkgs/dst';
import type { SchemaPeer } from './peers';
import { SCHEMA_SERVER_ID } from './peers';

export type SchemaSurface = {
  readonly session: Session;
  readonly server: SchemaPeer;
  readonly clients: readonly SchemaPeer[];
};

export function peerIds(s: SchemaSurface): readonly string[] {
  return [SCHEMA_SERVER_ID, ...s.clients.map((c) => c.id)];
}

export function resolveSurfacePeer(s: SchemaSurface, id: string): SchemaPeer {
  if (id === s.server.id) return s.server;
  const client = s.clients.find((c) => c.id === id);
  if (client === undefined) {
    throw new Error(`db-schema DST: no peer ${id}`);
  }
  return client;
}

export type { SchemaPeer };
export { SCHEMA_SERVER_ID };
