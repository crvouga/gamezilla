import { useSyncEnginePool } from '@libs/app-env-client-ts/client-env-context';
import { AppClientConfig } from '@libs/app-root-client-ts/app-client-config';
import type { ReadySyncEngine } from '@libs/app-root-client-ts/create-sync-engine-boot-state';
import { useSyncEngineBootViews } from '@libs/app-root-client-ts/use-sync-engine-boot-views';
import { reloadApp } from '@libs/app-root-shared-ts/reload-app';
import { AuthSyncBridge } from '@libs/auth-client-ts/auth-sync-bridge';
import { MutationClientProvider } from '@libs/auth-client-ts/mutation-client-provider';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { SqlClientProvider } from '@pkgs/sql-client-root-client-ts/solid';
import {
  SyncEnginePaintGateProvider,
  SyncEngineProvider,
} from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import type { JSX } from '@solidjs/web';
import { Match, onCleanup, Switch, untrack } from 'solid-js';

function SessionData(props: {
  readonly ready: ReadySyncEngine;
  readonly children: JSX.Element;
}): JSX.Element {
  const ready = untrack(() => props.ready);
  return (
    <SyncEnginePaintGateProvider ready={() => true}>
      <SyncEngineProvider value={ready.engine}>
        <SqlClientProvider value={ready.engine.db}>
          <AuthSyncBridge>
            <MutationClientProvider
              registry={ready.registry}
              turnGames={ready.turnGames}
            >
              <AppClientConfig>{props.children}</AppClientConfig>
            </MutationClientProvider>
          </AuthSyncBridge>
        </SqlClientProvider>
      </SyncEngineProvider>
    </SyncEnginePaintGateProvider>
  );
}

export function AdminSession(props: {
  readonly account: string;
  readonly children: JSX.Element;
}): JSX.Element {
  const pool = useSyncEnginePool();
  onCleanup(() => void pool.releaseAll());
  const views = useSyncEngineBootViews({ userId: () => props.account });
  return (
    <Switch fallback={<LoadingState />}>
      <Match when={views.bootError() ?? views.stuckError()}>
        <ErrorState
          title={<Trans>Could not open administration data</Trans>}
          body={
            <Trans>Close other administration tabs and reload this page.</Trans>
          }
          retry={{ label: <Trans>Reload</Trans>, onClick: reloadApp }}
        />
      </Match>
      <Match when={views.ready()} keyed>
        {(ready) => <SessionData ready={ready}>{props.children}</SessionData>}
      </Match>
    </Switch>
  );
}
