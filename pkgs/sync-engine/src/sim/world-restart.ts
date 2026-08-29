import { SqliteSchemaDatabaseMigration } from '@pkgs/db-schema/sqlite';
import { createLogger } from '@pkgs/logger';

import type { LocalDomainSchema } from '../client/local-schema-migrate';
import type { MutationRegistry } from '../mutations/core/types';
import type { QueryRegistry } from '../queries/core/types';
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

/** Silent migrate logger — level silent; `now` unused but required by createLogger. */
const serverMigrateLogger = createLogger({
  name: 'world-restart-server-migrate',
  level: 'silent',
  now: () => 0,
});

export type RestartServerOpts = {
  readonly preserveDb?: boolean;
  readonly checkpointFloor?: bigint;
  /** Additive domain schema migrate on preserved DB (rolling upgrade). */
  readonly localSchema?: LocalDomainSchema;
  readonly mutationRegistry?: MutationRegistry;
  readonly queryRegistry?: QueryRegistry;
};

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
    ...(opts?.sessionQuery !== undefined
      ? { sessionQuery: opts.sessionQuery }
      : {}),
  };
  const handle = await addClientImpl(k, args);
  if (preserve) meta.lastDbBundle = handle.dbBundle;
  return handle;
}

export async function restartServerImpl(
  k: BootedSimKernel,
  opts?: RestartServerOpts
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

  const localSchema = opts?.localSchema ?? k.domain.localSchema;
  const mutationRegistry = opts?.mutationRegistry ?? k.domain.mutationRegistry;
  const queryRegistry = opts?.queryRegistry ?? k.domain.queryRegistry;

  // Rolling upgrade: additive migrate preserved DB to the new domain schema.
  if (existingDb !== undefined && opts?.localSchema !== undefined) {
    await new SqliteSchemaDatabaseMigration(opts.localSchema.domainSchema, {
      ownership: 'declared-only',
    }).migrate({ sqlClient: existingDb, logger: serverMigrateLogger });
    // Keep domain pack in sync so later heal/settle restarts use the new schema.
    (k as { domain: BootedSimKernel['domain'] }).domain = {
      ...k.domain,
      localSchema,
      mutationRegistry,
      queryRegistry,
    };
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
    localSchema,
    mutationRegistry,
    queryRegistry,
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
