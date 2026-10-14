import type { ServerEnv } from '@libs/app-root-shared/server-env';
import { HARNESS_SERVER_URL } from '@libs/sub-shared/harness-constants';
import type { MembershipProviders } from '@pkgs/billing-root-shared/providers';
import type { Timers } from '@pkgs/clock-shared/types';
import type { Session } from '@pkgs/harness-root-shared/runtime-types';
import { createLogger } from '@pkgs/logger-shared/logger';
import {
  type createInMemoryBus,
  createInMemoryPubSub,
} from '@pkgs/pubsub-root-shared/in-memory';
import type { PubSub } from '@pkgs/pubsub-root-shared/interface';
import type { SharedServerServices } from './shared-server-services';

type ServerEnvDeps = {
  readonly serverEvents: PubSub | undefined;
  readonly id: string;
  readonly session: Session;
  readonly seed: bigint;
  readonly timers: Timers;
  readonly shared: SharedServerServices;
  readonly pubSubBus: ReturnType<typeof createInMemoryBus>;
  /** Outbound vendor HTTP: only the provider node is reachable. */
  readonly vendorFetch: ServerEnv['fetch'];
  /** This instance's membership adapter, or `null` when nothing is sold. */
  readonly billing: MembershipProviders | null;
};

export function buildServerEnv(args: ServerEnvDeps): ServerEnv {
  const { id, session, seed, timers, shared, pubSubBus } = args;
  return {
    clock: session.ports.clock,
    timers,
    createId: session.ports.createId,
    random: session.ports.random,
    seed,
    openSqlClient: () => Promise.resolve(shared.sqlClient),
    events:
      args.serverEvents ??
      createInMemoryPubSub({
        bus: pubSubBus,
        logger: createLogger({
          name: `harness-${id}:pubsub`,
          now: () => session.ports.clock.now(),
        }),
      }),
    kv: shared.kv,
    blob: shared.blob,
    billing: args.billing,
    tts: shared.tts,
    llm: shared.llm,
    secrets: shared.secrets,
    auth: shared.auth,
    moderation: shared.moderation,
    protection: 'standard',
    serverUrl: HARNESS_SERVER_URL,
    skipDatabaseUrlPolicy: true,
    fetch: args.vendorFetch,
  };
}
