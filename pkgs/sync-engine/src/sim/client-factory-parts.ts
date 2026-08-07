import type { PubSub } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { AppLifecycle } from '../client/app-lifecycle';
import { createLocalSyncEngine } from '../client/create-local-sync-engine';
import type { LocalDomainSchema } from '../client/local-schema-migrate';
import type { Timers } from '../client/sim-ports';
import type { SyncEngine } from '../client/sync-engine-port';
import {
  createMutationClient,
  type MutationClient,
} from '../mutations/client/create-mutation-client';
import type { MutationEnv, MutationRegistry } from '../mutations/core/types';
import type { QueryRegistry } from '../queries/core/types';
import type { SimHttpClient } from './http-bridge';

type SimClientLifecycle = {
  readonly lifecycle: AppLifecycle;
  readonly setForeground: (value: boolean) => void;
  readonly setOnline: (value: boolean) => void;
};

export type CreateEngineOptionsArgs = {
  readonly db: SqlClient;
  readonly tables: LocalDomainSchema;
  readonly mutations: MutationRegistry;
  readonly queries: QueryRegistry;
  readonly getEnv: () => MutationEnv;
  readonly deviceId: string;
  readonly actorId: string;
  readonly http: SimHttpClient;
  readonly lifecycle: SimClientLifecycle;
  readonly now: () => number;
  readonly random: () => number;
  readonly timers: Timers;
  readonly createId: () => string;
  readonly createPubSub: () => PubSub;
};

/** Options bag for {@link createLocalSyncEngine} from sim client args. */
export async function createEngineFromParts(
  args: CreateEngineOptionsArgs
): Promise<SyncEngine> {
  return createLocalSyncEngine({
    db: args.db,
    localSchema: args.tables,
    mutationRegistry: args.mutations,
    getMutationEnv: args.getEnv,
    getClientId: () => args.deviceId,
    bootQueries: [{ name: 'simNotes', params: {} }],
    postQueries: (rs) => args.http.postQueries(rs),
    postMutations: (ms) => args.http.postMutations(ms),
    isAuthRevoked: () => false,
    deleteDatabase: async () => undefined,
    lifecycle: args.lifecycle.lifecycle,
    now: args.now,
    random: args.random,
    timers: args.timers,
    createId: args.createId,
    nudges: {
      queryRegistry: args.queries,
      createPubSub: args.createPubSub,
      getChannelsCtx: () => ({ actorId: args.actorId }),
    },
  });
}

export type CreateMutationSideArgs = {
  readonly db: SqlClient;
  readonly mutations: MutationRegistry;
  readonly getEnv: () => MutationEnv;
  readonly deviceId: string;
  readonly createId: () => string;
  readonly lifecycle: SimClientLifecycle;
  readonly engine: SyncEngine;
};

/** Mutation client wired to wake uploads + fanout on apply. */
export function createMutationSide(
  args: CreateMutationSideArgs
): MutationClient {
  return createMutationClient({
    db: args.db,
    registry: args.mutations,
    env: args.getEnv(),
    ids: {
      clientId: args.deviceId,
      nextSeq: () => 1,
    },
    connectivity: { isOnline: () => args.lifecycle.lifecycle.isOnline() },
    createId: args.createId,
    onQueued: () => args.engine.wakeUploads(),
    onApplied: (event) => args.engine.fanoutMutation(event),
  });
}
