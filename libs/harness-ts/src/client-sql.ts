import type { ClientEnv } from '@libs/app-root-client-ts/client-env';
import { LAST_LOCAL_ACCOUNT_ID_KEY } from '@libs/auth-shared-ts/auth-storage-keys';
import type { OpenSqlClient } from '@libs/sub-shared-ts/sync';
import { createFaultInjectingSqlClient } from '@pkgs/sql-client-root-shared-ts/fault-injecting-sql-client';
import { STORAGE_FAULTS } from '@pkgs/sql-client-root-shared-ts/storage-faults';
import { openFreshHarnessClientSql } from './sql';
import type { HarnessSql } from './sql-types';
import { handleBoundSqlClient } from './sql-types';

type Databases = {
  readonly files: Map<string, Promise<HarnessSql>>;
  active: HarnessSql | null;
  generation: number;
};

const owners = new WeakMap<Map<string, HarnessSql>, Map<string, Databases>>();

function databases(handles: Map<string, HarnessSql>, id: string): Databases {
  let clients = owners.get(handles);
  if (clients === undefined) {
    clients = new Map();
    owners.set(handles, clients);
  }
  let state = clients.get(id);
  if (state === undefined) {
    state = { files: new Map(), active: null, generation: 0 };
    clients.set(id, state);
  }
  return state;
}

/** The inspector follows the active account; engine connections stay bound to their own file. */
function inspector(state: Databases): HarnessSql {
  const active = () => {
    if (state.active === null) throw new Error('Client database is not open');
    return state.active;
  };
  return {
    get sqlClient() {
      return active().sqlClient;
    },
    get databaseName() {
      return active().databaseName;
    },
    disconnect: async () => {
      for (const opened of state.files.values())
        await (await opened).disconnect();
      state.files.clear();
      state.active = null;
    },
    reset: () => active().reset(),
    exportBytes: () => active().exportBytes(),
    importBytes: (bytes) => active().importBytes(bytes),
  };
}

/** Mirror production's per-account SQLite files, including returning to an earlier account. */
export function harnessClientSql(input: {
  readonly id: string;
  readonly handles: Map<string, HarnessSql>;
  readonly clock: ClientEnv['clock'];
  readonly storage: ClientEnv['secureStorage'];
  /** True while the device's data is unusable: every database call fails. */
  readonly unusable?: () => boolean;
}): OpenSqlClient {
  const state = databases(input.handles, input.id);
  const view = input.handles.get(input.id) ?? inspector(state);
  return async (args) => {
    const generation = ++state.generation;
    const stored = await input.storage.hydrate(LAST_LOCAL_ACCOUNT_ID_KEY);
    const userId = args?.userId ?? stored ?? 'unbound';
    let opened = state.files.get(userId);
    if (opened === undefined) {
      opened = openFreshHarnessClientSql(
        `harness_client_${input.id}_${userId}`,
        input.clock
      );
      state.files.set(userId, opened);
    }
    const handle = await opened;
    if (generation === state.generation) {
      state.active = handle;
      input.handles.set(input.id, view);
    }
    const bound = handleBoundSqlClient(handle);
    if (input.unusable?.() !== true) return bound;
    const damaged = createFaultInjectingSqlClient(bound);
    damaged.breakWith(STORAGE_FAULTS.corrupt);
    return damaged.client;
  };
}
