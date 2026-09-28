/**
 * Client gating, case by case: the product's own hooks mounted in a Solid
 * tree under the real providers a device has — secure storage holding the
 * install's user id (and a session token when signed in), a sync engine over
 * a local SQLite database holding the synced rows the case needs (the
 * account's anonymity, memberships, the billing switch, the policy row when a
 * test changes it, feature rows), a virtual clock, seeded ids and the
 * device's mutation client. The probe reads what the app would show or do
 * once every local query has loaded.
 *
 * For tests and spec bindings only (a `root/` export). Needs the Solid test
 * environment (`--conditions=browser`, the `@pkgs/bun-test-solid` preload).
 */

import {
  DEVICE_ID_KEY,
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_TOKEN_KEY,
} from '@libs/auth/public/auth-storage-keys';
import { AUTH_TABLES } from '@libs/auth/public/schema';
import { createHarnessClock } from '@pkgs/clock/harness-clock';
import { ClockProvider } from '@pkgs/clock/solid';
import { registerTables, type TableDef } from '@pkgs/db-schema';
import type { DecisionOutput } from '@pkgs/dmn/evaluate';
import type { DecisionLayer } from '@pkgs/dmn/registry';
import { createInMemorySecureStorage } from '@pkgs/secure-storage/impl-memory';
import { createSecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import { SecureStorageStoreProvider } from '@pkgs/secure-storage/solid';
import { sql } from '@pkgs/sql';
import {
  type LocalDomainSchema,
  migrateLocalSchema,
  type SyncEngine,
  type WatchSubscription,
} from '@pkgs/sync-engine/client';
import { createInMemorySyncEngine } from '@pkgs/sync-engine/harness';
import type { MutationRegistry } from '@pkgs/sync-engine/shared';
import {
  MutationClientProvider,
  SyncEngineProvider,
} from '@pkgs/sync-engine/solid';
import { createHarnessIds } from '@pkgs/uuid';
import { IdProvider } from '@pkgs/uuid/solid';
import { createComponent, createRoot, type JSX } from 'solid-js';

import { authorizeAppMutation } from '../server/authorize-app-mutation';
import { CASE_NOW_MS, type CaseInput, DEVICE_ID, personOf } from './people';
import type { ServerCase } from './server';
import {
  type AppPolicy,
  mutationEnvFor,
  seedAccess,
  uniqueTables,
} from './world';

/** What the probe hands back once mounted: how to read the case's answer. */
export type ClientProbe = () => DecisionOutput | Promise<DecisionOutput>;

export type ClientLayerOptions = {
  /** Feature tables the hooks read (billing's included). */
  readonly tables: readonly TableDef[];
  /** Feature rows the case needs, written as synced rows. */
  readonly seed?: (c: ServerCase) => Promise<void>;
  /** Mutations the device may apply (for a gate that is a local apply). */
  readonly mutations?: MutationRegistry;
  /** A changed policy, synced as the device's policy row. */
  readonly policy?: AppPolicy;
  /** Which outputs the gate shows (default: the answer). */
  readonly observes?: readonly string[];
  /**
   * Runs inside the mounted tree (hooks allowed); returns how to read the
   * answer after the device's queries have loaded.
   */
  readonly probe: (input: CaseInput) => ClientProbe;
};

/** Every watch the tree opens, so the case waits until all have loaded. */
type Watches = { readonly all: WatchSubscription<unknown>[] };

function tracked(engine: SyncEngine, watches: Watches): SyncEngine {
  return {
    ...engine,
    watch: (query) => {
      const subscription = engine.watch(query);
      watches.all.push(subscription as WatchSubscription<unknown>);
      return subscription;
    },
  };
}

async function openDevice(tables: readonly TableDef[]): Promise<SyncEngine> {
  const all = uniqueTables([...AUTH_TABLES, ...tables]);
  const schema: LocalDomainSchema = {
    domainSchema: registerTables(all),
    cacheTableNames: all.map((table) => table.name),
  };
  const engine = await createInMemorySyncEngine({ schema });
  // The framework's own tables (the mutation queue) on top of the domain.
  await migrateLocalSchema(engine.db, schema);
  return engine;
}

async function seedDevice(
  c: ServerCase,
  options: ClientLayerOptions
): Promise<void> {
  await seedAccess(c.db, {
    input: c.input,
    nowMs: c.nowMs,
    policy: options.policy,
  });
  await c.db.run(sql`
    INSERT INTO auth_users (id, is_anon, created_at, updated_at, deleted_at)
    VALUES (${c.env.actorId}, ${c.env.isAnon}, ${'2026-01-01T00:00:00.000Z'},
      ${'2026-01-01T00:00:00.000Z'}, ${null})
  `);
  await options.seed?.(c);
}

async function secureStorageFor(c: ServerCase) {
  const store = createSecureStorageStore(createInMemorySecureStorage());
  await store.write(LAST_LOCAL_ACCOUNT_ID_KEY, c.env.actorId);
  await store.write(DEVICE_ID_KEY, DEVICE_ID);
  if (!c.env.isAnon) await store.write(SESSION_TOKEN_KEY, 'session-token');
  for (const key of [
    LAST_LOCAL_ACCOUNT_ID_KEY,
    DEVICE_ID_KEY,
    SESSION_TOKEN_KEY,
  ]) {
    await store.hydrate(key);
  }
  return store;
}

/** Let every pending microtask (local query results, memo updates) land. */
async function flush(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

async function loaded(watches: Watches): Promise<void> {
  for (let round = 0; round < 1_000; round += 1) {
    await flush();
    if (watches.all.every((watch) => watch.getHydrated())) {
      await flush();
      return;
    }
  }
  throw new Error('conformance: the device never finished loading its rows');
}

type Mounted = {
  readonly read: ClientProbe;
  readonly dispose: () => void;
};

function mount(
  c: ServerCase,
  device: {
    readonly engine: SyncEngine;
    readonly store: Awaited<ReturnType<typeof secureStorageFor>>;
    readonly options: ClientLayerOptions;
  }
): Mounted {
  const { clock, timers } = createHarnessClock({ startMs: c.nowMs });
  const ids = createHarnessIds(20_260_919);
  let read: ClientProbe | null = null;
  const probe = (): JSX.Element => {
    read = device.options.probe(c.input);
    return null;
  };
  const dispose = createRoot((disposeRoot) => {
    createComponent(SecureStorageStoreProvider, {
      value: device.store,
      get children() {
        return createComponent(SyncEngineProvider, {
          value: device.engine,
          get children() {
            return createComponent(ClockProvider, {
              clock,
              timers,
              get children() {
                return createComponent(IdProvider, {
                  createId: ids.createId,
                  random: ids.random,
                  get children() {
                    return createComponent(MutationClientProvider, {
                      registry: device.options.mutations ?? {},
                      env: c.env,
                      ids: { clientId: 'conformance-client' },
                      createId: ids.createId,
                      get children() {
                        return createComponent(probe, {});
                      },
                    });
                  },
                });
              },
            });
          },
        });
      },
    });
    return disposeRoot;
  });
  if (read === null) throw new Error('conformance: the probe never mounted');
  return { read, dispose };
}

async function answerCase(
  options: ClientLayerOptions,
  input: CaseInput
): Promise<DecisionOutput> {
  const watches: Watches = { all: [] };
  const engine = await openDevice(options.tables);
  const c: ServerCase = {
    db: engine.db,
    env: mutationEnvFor(personOf(input), CASE_NOW_MS),
    input,
    nowMs: CASE_NOW_MS,
    guard: authorizeAppMutation,
  };
  try {
    await seedDevice(c, options);
    const store = await secureStorageFor(c);
    const mounted = mount(c, {
      engine: tracked(engine, watches),
      store,
      options,
    });
    try {
      await loaded(watches);
      return await mounted.read();
    } finally {
      mounted.dispose();
    }
  } finally {
    await engine.disconnect();
  }
}

/** The client gating layer: what the device shows or does, per case. */
export function clientGatingLayer(options: ClientLayerOptions): DecisionLayer {
  return {
    observes: options.observes ?? ['answer'],
    decide: (input) => answerCase(options, input),
  };
}
