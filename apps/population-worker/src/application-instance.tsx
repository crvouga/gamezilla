// @io-wall-ok — isolated application composition root.
import { createClient } from '@libs/app-root-client/create-client';
import { createInMemoryClientPorts } from '@libs/app-root-client/in-memory-client-ports';
import { wallClientEnv } from '@libs/app-root-client/wall-client-env';
import { DEVICE_ID_KEY } from '@libs/auth-shared/auth-storage-keys';
import {
  authenticateThroughUi,
  configureUsername,
} from '@libs/population-shared/application-actions';
import type { Inspection } from '@libs/population-shared/inspection';
import { APP_FEATURE_CLIENTS } from '@libs/runtime-client/app-feature-clients';
import { APP } from '@libs/runtime-shared/app-features';
import { wallSpaceRoomTransport } from '@libs/spaces-client/wall-room-transport';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server/impl-bun-sqlite';
import { recordingDriver } from '@pkgs/ui-testing-root-shared/recording-driver';
import { createSolidDomDriver } from '@pkgs/ui-testing-solid-dom-client/solid-dom-driver';
import { createMemoryHistory } from '@solidjs/router';

/** Called inside one isolated realm, never on a shared DOM or module graph. */
export async function createApplicationInstance(input: {
  origin: string;
  deviceId: string;
  email: string;
  password: string;
  registered: boolean;
  username: string;
  route: string;
  onAction: (action: Inspection['actions'][number]) => void;
}) {
  localStorage.clear();
  sessionStorage.clear();
  const wall = wallClientEnv({
    serverUrl: input.origin,
    room: wallSpaceRoomTransport,
  });
  const env = {
    ...wall,
    ...createInMemoryClientPorts(),
    openSqlClient: async () => {
      const db = SqlClientImplBunSqlite.openMemory();
      await db.connect();
      return db;
    },
  };
  await env.secureStorage.write(DEVICE_ID_KEY, input.deviceId);
  const client = createClient(env, {
    features: APP_FEATURE_CLIENTS,
    loadApp: async () => APP,
  });
  const history = createMemoryHistory();
  const rawDriver = createSolidDomDriver({
    clock: env.clock,
    document,
    pump: () =>
      new Promise<void>((resolve) => env.timers.setTimeout(resolve, 1)),
    defaultTimeoutMs: 15_000,
    harness: {
      createRoot: () => () => <client.App embedded history={history} />,
    },
  });
  const driver = recordingDriver(rawDriver, {
    recorder: {
      async record(meta, run) {
        // Selector and operation are useful; input text and report snapshots contain credentials.
        const action =
          `${meta.selector ?? ''}: ${meta.title.split(' ')[0] ?? 'action'}`.slice(
            0,
            256
          );
        input.onAction({ action, atMs: env.clock.now(), outcome: 'started' });
        try {
          const value = await run();
          input.onAction({
            action,
            atMs: env.clock.now(),
            outcome: 'completed',
          });
          return value;
        } catch (error) {
          input.onAction({ action, atMs: env.clock.now(), outcome: 'failed' });
          throw error;
        }
      },
    },
  });
  try {
    await driver.launch();
    await authenticateThroughUi(driver, input);
    const token = await env.createAuthClient().getFreshToken();
    if (token === null)
      throw new Error('Normal authentication did not establish a session');
    await configureUsername(driver, input.username);
    history.set({ value: input.route, replace: true });
    return {
      driver,
      client,
      env,
      token,
      route: () => history.get(),
      async close() {
        await driver.close();
        await client.close();
      },
    };
  } catch (error) {
    await driver.close();
    await client.close();
    throw error;
  }
}
