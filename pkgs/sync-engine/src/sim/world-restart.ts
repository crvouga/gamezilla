import type { SimClientHandle } from './client-factory';
import { SIM_SERVER_NODE_ID } from './clock-skew';
import { bindSimHttpServer } from './http-bridge';
import { isDbOpen } from './invariants';
import { openSimServer } from './server';
import { SERVER_HTTP } from './traffic';
import {
  crashClientImpl,
  fireCrashIfArmed,
  type RestartClientOpts,
} from './world-lifecycle';
import { addClientImpl } from './world-ops-add-client';
import type { AddClientArgs, BootedSimKernel } from './world-types';

export async function restartClientImpl(
  k: BootedSimKernel,
  id: string,
  opts?: RestartClientOpts
): Promise<SimClientHandle> {
  const meta = k.metas.get(id);
  if (meta === undefined) throw new Error(`unknown client meta ${id}`);
  const existing = k.clients.get(id);
  let preserve = opts?.preserveLocalDb === true;
  if (preserve && existing?.dbBundle !== undefined) {
    meta.lastDbBundle = existing.dbBundle;
  }
  let existingDb = preserve
    ? (existing?.dbBundle ?? meta.lastDbBundle)
    : undefined;
  // Revoke wipe closes SQLite; keepDb must not hand a dead handle to migrate.
  if (existingDb !== undefined && !(await isDbOpen(existingDb.serial))) {
    existingDb = undefined;
    delete meta.lastDbBundle;
    preserve = false;
  }
  if (k.clients.has(id)) {
    await crashClientImpl(k, id, { keepDb: preserve });
  }
  k.authStatusByDevice.set(meta.deviceId, 'valid');
  const args: AddClientArgs = {
    id: meta.id,
    actorId: meta.actorId,
    ...(existingDb !== undefined ? { existingDb } : {}),
    ...(opts?.schemaEpoch !== undefined
      ? { schemaEpoch: opts.schemaEpoch }
      : {}),
    ...(opts?.localSchema !== undefined
      ? { localSchema: opts.localSchema }
      : {}),
    ...(opts?.mutationRegistry !== undefined
      ? { mutationRegistry: opts.mutationRegistry }
      : {}),
    ...(opts?.queryRegistry !== undefined
      ? { queryRegistry: opts.queryRegistry }
      : {}),
  };
  const handle = await addClientImpl(k, args);
  if (preserve) meta.lastDbBundle = handle.dbBundle;
  return handle;
}

export async function restartServerImpl(
  k: BootedSimKernel,
  opts?: {
    readonly preserveDb?: boolean;
    readonly checkpointFloor?: bigint;
  }
): Promise<void> {
  k.unbindHttp();
  const preserve = opts?.preserveDb !== false;
  const existingDb = preserve ? k.server.db : undefined;
  const prevHw = k.server.checkpointHighWater();
  const explicit = opts?.checkpointFloor ?? 0n;
  const checkpointFloor = explicit > prevHw ? explicit : prevHw;
  if (!preserve) {
    await k.server.dispose();
  }
  k.server = await openSimServer({
    now: () => k.nowFor(SIM_SERVER_NODE_ID),
    createId: k.nextId,
    pubsub: k.serverPub,
    resolveAuth: (clientId) => {
      const meta = k.authByDevice.get(clientId);
      if (meta === undefined) {
        return {
          actorId: clientId,
          deviceId: clientId,
          accountId: null,
          isAnon: true,
        };
      }
      return {
        actorId: meta.actorId,
        deviceId: meta.deviceId,
        accountId: `acct:${meta.actorId}`,
        isAnon: false,
      };
    },
    rowImageFanout: k.worldArgs.rowImageFanout !== false,
    localSchema: k.domain.localSchema,
    mutationRegistry: k.domain.mutationRegistry,
    queryRegistry: k.domain.queryRegistry,
    faults: k.faults,
    ...(k.domain.topicMap !== undefined ? { topicMap: k.domain.topicMap } : {}),
    ...(existingDb !== undefined
      ? { existingDb, onDisposeDb: () => Promise.resolve() }
      : {}),
    ...(checkpointFloor > 0n ? { checkpointFloor } : {}),
  });
  k.unbindHttp = bindSimHttpServer({
    network: k.network,
    serverId: SERVER_HTTP,
    handlers: k.server.handlers,
    faults: k.faults,
    onMutationsAccepted: async (clientNodeId) => {
      await fireCrashIfArmed(k, clientNodeId, 'afterNextMutationsPostAccepted');
    },
  });
}
