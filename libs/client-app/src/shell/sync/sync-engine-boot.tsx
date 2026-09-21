/** @jsxImportSource solid-js */
/**
 * Opens local SQLite for the active `users.id` and exposes the sync engine +
 * mutation client.
 *
 * Waits for `LocalIdentityProvider` to bind a user id (local, not HTTP). The
 * pool deactivates the prior engine across identity / database-name changes
 * (web OPFS handle released), so the tree shows a loading shell until the
 * next engine is ready. Never waits on network first-sync.
 *
 * If open hangs (stale SharedWorker / HTML-as-JS after deploy), a watchdog
 * flips to {@link LocalDatabaseBootErrorScreen} with Reload — never leave a
 * blank white screen.
 */

import { createMemo, type JSX, lazy, Match, Show, Switch } from 'solid-js';
import { BootLoadingShell } from '../boot/boot-loading-shell';
import { useLocalIdentity } from '../identity/identity-context';
import { LocalDatabaseBootErrorScreen } from './boot-error-screen';
import { useSyncEngineBootViews } from './use-sync-engine-boot-views';

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
  const views = useSyncEngineBootViews({
    userId: () => props.userId,
    preloadReadyTree: () => ReadyEngineTree.preload(),
  });

  return (
    <Switch fallback={<BootLoadingShell />}>
      <Match when={views.bootError()} keyed>
        {(error) => <LocalDatabaseBootErrorScreen error={error} />}
      </Match>
      <Match when={views.stuckError()} keyed>
        {(error) => <LocalDatabaseBootErrorScreen error={error} />}
      </Match>
      <Match when={views.ready()} keyed>
        {(value) => (
          <ReadyEngineTree
            ready={value}
            userId={props.userId}
            deviceId={props.deviceId}
            paintReady={() => views.ready() === value}
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
    <Show when={bound()} fallback={<BootLoadingShell />} keyed>
      {(ids) => (
        <SyncEngineBootWithUser userId={ids.userId} deviceId={ids.deviceId}>
          {props.children}
        </SyncEngineBootWithUser>
      )}
    </Show>
  );
}
