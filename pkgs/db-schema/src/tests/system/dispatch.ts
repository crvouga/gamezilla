import type { World } from '@pkgs/determinism';
import {
  advancePeer,
  planKindHash,
  reconcilePeer,
  requireServer,
  resolvePeer,
  type SchemaSystem,
} from './peers';
import { forbiddenSchema, type SchemaVersion } from './schemas';

type SchemaWorld = World<SchemaSystem>;

export async function applyAdvance(
  world: SchemaWorld,
  target: string,
  to: SchemaVersion
): Promise<void> {
  const server = requireServer(world.state);
  const peer = resolvePeer(world.state, target);
  const wanted = Math.max(peer.version, to) as SchemaVersion;
  // Clients never run ahead of the server they sync against.
  const capped =
    peer.kind === 'client'
      ? (Math.min(wanted, server.version) as SchemaVersion)
      : wanted;
  if (capped > peer.version) {
    await advancePeer(peer, capped);
  }
}

export async function applyForbidden(world: SchemaWorld): Promise<void> {
  const server = requireServer(world.state);
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
