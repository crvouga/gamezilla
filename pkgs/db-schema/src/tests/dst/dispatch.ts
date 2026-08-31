import type { DstWorld, JsonValue } from '@pkgs/dst';
import type { AdvanceAction, SchemaAction } from './actions';
import {
  advancePeer,
  planKindHash,
  reconcilePeer,
  requireServer,
  resolvePeer,
  type SchemaSystem,
} from './peers';
import { forbiddenSchema, type SchemaVersion } from './schemas';

type SchemaWorld = DstWorld<SchemaSystem>;

async function applyAdvance(
  world: SchemaWorld,
  action: AdvanceAction
): Promise<void> {
  const server = requireServer(world.system);
  const peer = resolvePeer(world.system, action.target);
  const wanted = Math.max(peer.version, action.to) as SchemaVersion;
  // Clients never run ahead of the server they sync against.
  const capped =
    peer.kind === 'client'
      ? (Math.min(wanted, server.version) as SchemaVersion)
      : wanted;
  if (capped > peer.version) {
    await advancePeer(peer, capped);
  }
}

async function applyForbidden(world: SchemaWorld): Promise<void> {
  const server = requireServer(world.system);
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

export async function dispatchSchemaAction(
  world: SchemaWorld,
  op: JsonValue
): Promise<void> {
  const action = op as SchemaAction;
  if (action.kind === 'advance') {
    await applyAdvance(world, action);
    return;
  }
  await applyForbidden(world);
}
