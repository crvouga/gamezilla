/** @jsxImportSource solid-js */
/**
 * The only client constructor — wall (`main.tsx`) and harnesses pass different
 * `ClientEnv` implementations and different sub sets. `App` owns the
 * router: the browser `Router` (URL is the source of truth) or, when
 * `embedded`, a `MemoryRouter` so several product Apps can share one page (or
 * a test can drive `history`).
 *
 * The shell names no sub. Routes, tabs, docks and providers all come from
 * the `subs` fold, so booting one bounded context and booting all of them
 * is the same code path with a different argument — which is what lets a
 * sub's own spec run the real shell.
 */

import type { SubClient } from '@libs/sub-client/client';
import { composeSubClients } from '@libs/sub-client/compose-client';
import {
  type MemoryHistory,
  MemoryRouter,
  Router,
  type RouteSectionProps,
} from '@solidjs/router';
import { type Component, type JSX, Show, untrack } from 'solid-js';
import type { AppComposition, LoadComposedSubs } from './app-subs-context';
import { AppCompositionProvider } from './app-subs-context';
import type { ClientEnv } from './client-env';
import { ClientEnvProvider } from './client-env-context';
import { ProductApp } from './product-app';
import { buildRouteTable } from './route-table';
import { buildAppRoutes } from './routes';
import type { AppSyncEnginePool } from './sync-engine-pool';
import { createAppSyncEnginePool } from './sync-engine-pool';

export type ClientAppProps = {
  /** Multi-App product-harness / tests: in-memory router, no document shortcuts. */
  readonly embedded?: boolean | undefined;
  /** Embedded only: externally owned history (tests drive navigation). */
  readonly history?: MemoryHistory | undefined;
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

function makeRoot(embedded: boolean): Component<RouteSectionProps> {
  return (props) => (
    <ProductApp embedded={embedded}>{props.children}</ProductApp>
  );
}

export function createClient(env: ClientEnv, args: CreateClientArgs): Client {
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
    return (
      <ClientEnvProvider env={env} syncEnginePool={syncEnginePool}>
        <AppCompositionProvider value={composition}>
          <Show
            when={embedded}
            fallback={<Router root={makeRoot(false)}>{routes}</Router>}
          >
            <MemoryRouter
              root={makeRoot(true)}
              {...(history === undefined ? {} : { history })}
            >
              {routes}
            </MemoryRouter>
          </Show>
        </AppCompositionProvider>
      </ClientEnvProvider>
    );
  };
  return {
    env,
    syncEnginePool,
    App,
    close: () => syncEnginePool.releaseAll(),
  };
}
