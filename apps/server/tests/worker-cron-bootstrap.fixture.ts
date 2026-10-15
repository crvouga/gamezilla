import { mock } from 'bun:test';
import type { createServer } from '@libs/app-root-server/create-server';
import { setOutboxConsumerRegistry } from '@libs/app-root-server/outbox-drain';
import type { ServerEnv } from '@libs/app-root-shared/server-env';

type SqlClient = Awaited<ReturnType<ServerEnv['openSqlClient']>>;

let composed = 0;
let queried = 0;
let closed = 0;
const db: SqlClient = {
  connect: async () => {},
  disconnect: async () => {},
  query: async () => {
    queried++;
    return [];
  },
  run: async () => ({ changes: 0, lastInsertRowid: 0 }),
  transaction: async (work) => work(db),
  prepare: () => {
    throw new Error('unexpected prepared statement');
  },
};
mock.module('@libs/app-root-server/open-request-db-postgres', () => ({
  openRequestDb: async () => ({
    kind: 'postgres',
    sqlClient: db,
    pool: {
      end: async () => {
        closed++;
      },
    },
  }),
}));
mock.module('@libs/app-root-server/object-store', () => ({
  createApiObjectStore: async () => ({}),
}));
mock.module('@libs/app-root-server/create-server', () => ({
  createServer: async (
    _env: unknown,
    args: Parameters<typeof createServer>[1]
  ) => {
    composed++;
    setOutboxConsumerRegistry(args.servers.outboxConsumers, args.app.topicMap);
    return { fetch: async () => new Response('ok') };
  },
}));
const { default: worker } = await import('@apps/server/worker');
const background: Promise<unknown>[] = [];
const ctx = {
  waitUntil: (work: Promise<unknown>) => {
    background.push(work);
  },
  passThroughOnException: () => {},
};
const env = {
  SECRETS_ENV: 'dev',
  DATABASE_URL: 'postgres://fixture:fixture@localhost/fixture',
  OBSERVABILITY_ENABLED: '0',
};
// A scheduled event is the first invocation in this isolate: no HTTP warmup.
await worker.scheduled!(
  { cron: '*/1 * * * *', scheduledTime: 0, noRetry: false },
  env,
  ctx
);
await Promise.all(background);
await worker.scheduled!(
  { cron: '*/1 * * * *', scheduledTime: 60_000, noRetry: false },
  env,
  ctx
);
await Promise.all(background);
process.stdout.write(
  JSON.stringify({ composed, queried: queried > 0, closed })
);
