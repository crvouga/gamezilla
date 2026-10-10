// @io-wall-ok — isolated application composition root.
import { createClient } from '@libs/app-root-client/create-client';
import { createInMemoryClientPorts } from '@libs/app-root-client/in-memory-client-ports';
import { wallClientEnv } from '@libs/app-root-client/wall-client-env';
import { DEVICE_ID_KEY } from '@libs/auth-shared/auth-storage-keys';
import { APP_SUB_CLIENTS } from '@libs/runtime-client/app-sub-clients';
import { APP } from '@libs/runtime-shared/app-subs';
import { wallSpaceRoomTransport } from '@libs/spaces-client/wall-room-transport';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server/impl-bun-sqlite';
import { createSolidDomDriver } from '@pkgs/ui-testing-solid-dom-client/solid-dom-driver';
import { createMemoryHistory } from '@solidjs/router';
import { type RecordingInput, recordedUi } from './recorded-ui';

export async function createApplicationHost(
  input: RecordingInput & {
    origin: string;
    deviceId: string;
  }
) {
  localStorage.clear();
  sessionStorage.clear();
  const devicePorts = createInMemoryClientPorts();
  const wall = wallClientEnv({
    serverUrl: input.origin,
    room: wallSpaceRoomTransport,
    objectStore: devicePorts.objectStore,
  });
  // The ordinary HTTP health gate is registered against this environment identity.
  const env = Object.assign(wall, devicePorts, {
    openSqlClient: async () => {
      const db = SqlClientImplBunSqlite.openMemory();
      await db.connect();
      return db;
    },
  });
  await env.secureStorage.write(DEVICE_ID_KEY, input.deviceId);
  const client = createClient(env, {
    subs: APP_SUB_CLIENTS,
    loadApp: async () => APP,
  });
  const history = createMemoryHistory();
  const raw = createSolidDomDriver({
    clock: env.clock,
    document,
    pump: () =>
      new Promise<void>((resolve) => env.timers.setTimeout(resolve, 1)),
    defaultTimeoutMs: 15_000,
    harness: {
      createRoot: () => () => <client.App embedded history={history} />,
    },
  });
  const driver = recordedUi(raw, env.clock, input);
  return {
    driver,
    client,
    env,
    history,
    async close() {
      await driver.close();
      await client.close();
    },
  };
}
