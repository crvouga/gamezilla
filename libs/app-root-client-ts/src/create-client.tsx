/** @jsxImportSource @solidjs/web */
/**
 * The only client constructor — wall (`main.tsx`) and harnesses pass different
 * `ClientEnv` implementations and different sub sets. `App` owns the
 * router: browser history (URL is the source of truth) or, when `embedded`,
 * a memory history so several product Apps can share one page (or a test can
 * drive `history`).
 *
 * The shell names no sub. Routes, tabs, docks and providers all come from
 * the `subs` fold, so booting one bounded context and booting all of them
 * is the same code path with a different argument — which is what lets a
 * sub's own spec run the real shell.
 */

import type { ClientEnv } from '@libs/app-env-client-ts/client-env';
import { ClientEnvProvider } from '@libs/app-env-client-ts/client-env-context';
import type { AppSyncEnginePool } from '@libs/app-env-client-ts/sync-engine-pool';
import { createAppSyncEnginePool } from '@libs/app-env-client-ts/sync-engine-pool';
import type { SubClient } from '@libs/sub-client-ts/client';
import { composeSubClients } from '@libs/sub-client-ts/compose-client';
import {
  createRouter,
  type MemoryHistoryAdapter,
  memoryHistory,
  type RouteDefinition,
  type RouterHistory,
} from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { type Component, untrack } from 'solid-js';
import type { AppComposition, LoadComposedSubs } from './app-subs-context';
import { AppCompositionProvider } from './app-subs-context';
import { createOfflineClientEnv } from './offline-client-env';
import type { OfflineNetworkController } from './offline-network-controller';
import { OfflinePreferenceProvider } from './offline-preference';
import { ProductApp } from './product-app';
import { buildRouteTable } from './route-table';
import { buildAppRoutes } from './routes';

/**
 * The part of a memory history the embedded router drives. A caller that
 * owns one keeps the route across remounts and navigates by writing to it.
 */
export type EmbeddedHistory = Pick<
  MemoryHistoryAdapter,
  'get' | 'set' | 'go' | 'listen'
>;

export type ClientAppProps = {
  /** Multi-App product-harness / tests: in-memory router, no document shortcuts. */
  readonly embedded?: boolean | undefined;
  /** Embedded only: externally owned history (tests drive navigation). */
  readonly history?: EmbeddedHistory | undefined;
};

export type Client = {
  readonly env: ClientEnv;
  readonly syncEnginePool: AppSyncEnginePool;
  readonly App: Component<ClientAppProps>;
  close(): Promise<void>;
};

export type CreateClientOptions = {
  /** Stable key so the engine pool survives HMR (production only). */
  readonly poolGlobalKey?: string | undefined;
  /** Browser entry services share this kill switch with the product env. */
  readonly offlineController?: OfflineNetworkController | undefined;
};

export type CreateClientArgs = CreateClientOptions & {
  /**
   * The bounded contexts this client runs. Production passes every sub;
   * a subsystem harness passes the platform plus the one under test. The
   * shell itself names none of them.
   */
  readonly subs: readonly SubClient[];
  /**
   * The same subs' data halves — schema, queries, wake topics, writes —
   * behind a thunk. The shell holds no product registry of its own, and the
   * fold must not reach the entry chunk: it is first needed when the local
   * database opens, well after first paint.
   */
  readonly loadApp: LoadComposedSubs;
};

/** The router hears every write to the history, its own commits excepted. */
function embeddedRouterHistory(history: EmbeddedHistory): RouterHistory {
  return {
    get: history.get,
    set: history.set,
    init: history.listen,
    utils: { go: history.go },
  };
}

/**
 * One router per mounted App: an embedded App's history arrives with the
 * mount, and several embedded Apps share a page, each on its own history.
 */
function createAppRouter(
  routes: RouteDefinition[],
  history: EmbeddedHistory | undefined,
  embedded: boolean
) {
  if (!embedded) {
    // Screens scroll inside their own containers, so the document has no
    // scroll position worth restoring.
    return createRouter({ routes, scrollRestoration: false });
  }
  return createRouter({
    routes,
    history: embeddedRouterHistory(history ?? memoryHistory()),
  });
}

export function createClient(env: ClientEnv, args: CreateClientArgs): Client {
  const network = createOfflineClientEnv(env, args.offlineController);
  const syncEnginePool = createAppSyncEnginePool({
    loadMutations: async () => await (await args.loadApp()).mutations(),
    ...(args.poolGlobalKey === undefined
      ? {}
      : { globalKey: args.poolGlobalKey }),
  });
  const composition: AppComposition = {
    clients: composeSubClients(args.subs),
    loadApp: args.loadApp,
  };
  const routes = buildAppRoutes(buildRouteTable(composition.clients.routes));
  const App = (props: ClientAppProps): JSX.Element => {
    // Composition-root configuration: read once, not tracked.
    const { embedded, history } = untrack(() => ({
      embedded: props.embedded === true,
      history: props.history,
    }));
    const Router = createAppRouter(routes, history, embedded);
    return (
      <OfflinePreferenceProvider controller={network.offline}>
        <ClientEnvProvider env={network.env} syncEnginePool={syncEnginePool}>
          <AppCompositionProvider value={composition}>
            <Router>
              {(route) => (
                <ProductApp embedded={embedded}>{route.children}</ProductApp>
              )}
            </Router>
          </AppCompositionProvider>
        </ClientEnvProvider>
      </OfflinePreferenceProvider>
    );
  };
  return {
    env: network.env,
    syncEnginePool,
    App,
    close: () => syncEnginePool.releaseAll(),
  };
}
