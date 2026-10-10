import type { ServerEnv } from '@libs/app-root-shared/server-env';
import { HARNESS_SERVER_URL } from '@libs/feature-shared/harness-constants';
import type { Clock } from '@pkgs/clock-shared/types';
import { KvImplPostgres } from '@pkgs/kv-postgres-shared/impl-postgres';
import { createRecordSecretStore } from '@pkgs/secret-store-shared/record-secret-store';
import { InMemoryTtsProvider } from '@pkgs/tts-root-server/in-memory-tts-provider';
import { type AppleClientKeys, harnessIdpSecrets } from './idp';
import { createHarnessLlm } from './mockingbird-llm';
import { createHarnessObjectStore } from './mockingbird-object-store';
import type { HarnessSql } from './sql-types';
import { sharedSqlClient } from './sql-types';

/**
 * Services a production fleet shares across API instances. Per-instance copies
 * would hide shared-state bugs (a Kv write on one instance must be visible on
 * the next request, whichever instance the balancer picks).
 */
export type SharedServerServices = {
  readonly kv: ServerEnv['kv'];
  readonly blob: ServerEnv['blob'];
  readonly tts: ServerEnv['tts'];
  readonly llm: ServerEnv['llm'];
  readonly secrets: ServerEnv['secrets'];
  readonly auth: ServerEnv['auth'];
  readonly moderation: ServerEnv['moderation'];
  readonly sqlClient: Awaited<ReturnType<ServerEnv['openSqlClient']>>;
};

export function buildSharedServerServices(args: {
  readonly secretValues?: Readonly<Record<string, string>>;
  readonly serverSql: HarnessSql;
  readonly appleKeys: AppleClientKeys;
  readonly auth: ServerEnv['auth'];
  readonly clock: Clock;
  readonly moderation: ServerEnv['moderation'];
}): SharedServerServices {
  const secrets = createRecordSecretStore({
    DATABASE_URL: 'postgresql://mockingbird-postgres/harness',
    API_URL: HARNESS_SERVER_URL,
    ...harnessIdpSecrets(args.appleKeys),
    ...args.secretValues,
  });
  return {
    kv: new KvImplPostgres(args.serverSql.sqlClient, () => args.clock.now()),
    blob: createHarnessObjectStore(args.clock),
    tts: new InMemoryTtsProvider(),
    llm: createHarnessLlm({ clock: args.clock }).provider,
    secrets,
    // The simulated deployment signs in through the in-house IdP.
    auth: args.auth,
    moderation: args.moderation,
    sqlClient: sharedSqlClient(args.serverSql.sqlClient),
  };
}
