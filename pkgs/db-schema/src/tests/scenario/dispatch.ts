import {
  advancePeer,
  planKindHash,
  reconcilePeer,
  type SchemaPeer,
} from './peers';
import { forbiddenSchema, type SchemaVersion } from './schemas';
import type { SchemaSurface } from './types';
import { resolveSurfacePeer } from './types';

export async function applyAdvance(
  surface: SchemaSurface,
  target: string,
  to: SchemaVersion
): Promise<void> {
  const peer = resolveSurfacePeer(surface, target);
  const wanted = Math.max(peer.version, to) as SchemaVersion;
  const capped =
    peer.kind === 'client'
      ? (Math.min(wanted, surface.server.version) as SchemaVersion)
      : wanted;
  if (capped > peer.version) {
    await advancePeer(peer, capped);
  }
}

export async function applyForbidden(surface: SchemaSurface): Promise<void> {
  const server = surface.server;
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

export type { SchemaPeer };
