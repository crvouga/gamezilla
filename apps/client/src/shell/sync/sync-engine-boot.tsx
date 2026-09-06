/** @jsxImportSource solid-js */
/**
 * Opens local SQLite for the active `users.id` and exposes the sync engine +
 * mutation client.
 *
 * Waits for `LocalIdentityProvider` to bind a user id (local, not HTTP). The
 * pool deactivates the prior engine across identity / database-name changes
 * (web OPFS handle released), so the tree shows a blank themed shell until the
 * next engine is ready. Never waits on network first-sync.
 */

import type { SyncApiFetch, SyncClientAuth } from '@apps/client/sync/sync-api';
import { useLogger } from '@pkgs/logger/solid';
import { instrumentFetch } from '@pkgs/observability/client/instrument-fetch';
import { useObservability } from '@pkgs/observability/client/solid';
import {
  createEffect,
  createMemo,
  type JSX,
  lazy,
  Match,
  Show,
  Switch,
} from 'solid-js';
import { BlankShell } from '../boot/blank-shell';
import { useLocalPaintLatch } from '../boot/local-paint-latch';
import { useClientEnv, useSyncEnginePool } from '../client-env-context';
import { useLocalIdentity } from '../identity/identity-context';
import { originAvailabilityFor } from '../origin-availability-for-env';
import { LocalDatabaseBootErrorScreen } from './boot-error-screen';
import {
  createSyncEngineBootState,
  type ReadySyncEngine,
} from './create-sync-engine-boot-state';

/**
 * Engine provider tree (`@pkgs/sync-engine/solid` + mutation client). Lazy so
 * the SQL AST parser stays out of the initial chunk; preloaded with the engine
 * so it is resolved by the time the boot state flips to `ready`.
 */
const ReadyEngineTree = lazy(() => import('./sync-engine-ready-tree'));

function SyncEngineBootWithUser(props: {
  readonly userId: string;
  readonly deviceId: string;
  readonly children: JSX.Element;
}): JSX.Element {
  const env = useClientEnv();
  const pool = useSyncEnginePool();
  const identity = useLocalIdentity();
  const observability = useObservability();
  const log = useLogger('sync-engine-boot');
  const latch = useLocalPaintLatch();
  const fetchFn: SyncApiFetch = instrumentFetch(observability, env.server);
  const availability = originAvailabilityFor(env);
  const auth: SyncClientAuth = {
    getAccountId: () => identity.userId(),
    getDeviceId: () => identity.deviceId(),
    getSessionToken: () => identity.sessionToken(),
  };

  const databaseName = createMemo(() =>
    env.resolveDatabaseName({ userId: props.userId })
  );

  const bootPromise = createMemo<Promise<ReadySyncEngine>>(() => {
    const engine = pool.getOrCreate({
      openSqlClient: (args) => env.openSqlClient(args),
      createPubSub: () => env.createPubSub(),
      config: { getApiUrl: () => env.serverUrl },
      fetchFn,
      auth,
      clock: env.clock,
      timers: env.timers,
      createId: env.createId,
      random: env.random,
      getFreshAuthToken: () => Promise.resolve(identity.sessionToken()),
      databaseName: databaseName(),
      userId: props.userId,
      ...(availability.kind === 'health'
        ? {
            waitUntilAvailable: (signal?: AbortSignal | null) =>
              availability.waitUntilAvailable(signal),
          }
        : {}),
    });
    return Promise.all([
      engine,
      pool.mutationRegistry(),
      ReadyEngineTree.preload(),
    ]).then(async ([resolved, registry]) => {
      await resolved.connect();
      return { engine: resolved, registry };
    });
  });

  const boot = createSyncEngineBootState({
    boot: bootPromise,
    warm: () => null,
    onError: (error) =>
      log.error('local database boot failed', { error: error.message }),
  });

  createEffect(() => {
    if (boot().phase !== 'loading') latch.markEngineReady();
  });

  const bootError = (): Error | null => {
    const state = boot();
    return state.phase === 'error' ? state.error : null;
  };
  const ready = (): ReadySyncEngine | null => {
    const state = boot();
    return state.phase === 'ready' ? state.ready : null;
  };

  return (
    <Switch fallback={<BlankShell />}>
      <Match when={bootError()} keyed>
        {(error) => <LocalDatabaseBootErrorScreen error={error} />}
      </Match>
      <Match when={ready()} keyed>
        {(value) => (
          <ReadyEngineTree
            ready={value}
            userId={props.userId}
            deviceId={props.deviceId}
            paintReady={() => ready() === value}
          >
            {props.children}
          </ReadyEngineTree>
        )}
      </Match>
    </Switch>
  );
}

export function SyncEngineBoot(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const identity = useLocalIdentity();
  const bound = createMemo(() => {
    const userId = identity.userId();
    const deviceId = identity.deviceId();
    return userId !== null && deviceId !== null ? { userId, deviceId } : null;
  });
  return (
    <Show when={bound()} fallback={<BlankShell />} keyed>
      {(ids) => (
        <SyncEngineBootWithUser userId={ids.userId} deviceId={ids.deviceId}>
          {props.children}
        </SyncEngineBootWithUser>
      )}
    </Show>
  );
}
