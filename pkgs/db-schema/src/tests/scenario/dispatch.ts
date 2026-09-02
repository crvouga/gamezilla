import type { World } from '@pkgs/dst';
import {
  advancePeer,
  planKindHash,
  reconcilePeer,
  requireServer,
  resolvePeer,
  type SchemaPeer,
} from './peers';
import { forbiddenSchema, type SchemaVersion } from './schemas';

type SchemaWorld = World<
  Record<string, import('@pkgs/dst').KnobDef>,
  Record<string, import('@pkgs/dst').NodeEntry>
>;

function peersOf(world: SchemaWorld): {
  readonly server: SchemaPeer;
  readonly clients: ReadonlyMap<string, SchemaPeer>;
} {
  return {
    server: requireServer(world.nodes['server'] as SchemaPeer),
    clients: world.nodes['client'] as ReadonlyMap<string, SchemaPeer>,
  };
}

export async function applyAdvance(
  world: SchemaWorld,
  target: string,
  to: SchemaVersion
): Promise<void> {
  const { server, clients } = peersOf(world);
  const peer = resolvePeer(server, clients, target);
  const wanted = Math.max(peer.version, to) as SchemaVersion;
  const capped =
    peer.kind === 'client'
      ? (Math.min(wanted, server.version) as SchemaVersion)
      : wanted;
  if (capped > peer.version) {
    await advancePeer(peer, capped);
  }
}

export async function applyForbidden(world: SchemaWorld): Promise<void> {
  const server = peersOf(world).server;
  const before = planKindHash(server);
  let refused = false;
  try {
    await reconcilePeer(server, forbiddenSchema());
  } catch {
    refused = true;
  }
  if (!refused) {
    throw new Error('server accepted a forbidden in-place column type change');
  }
  if (planKindHash(server) !== before) {
    throw new Error('refused reconcile mutated the server plan history');
  }
}
