/** @jsxImportSource solid-js */
/**
 * The client half of the fold: a set of {@link FeatureClient}s becomes one
 * route table, one tab bar and two nested provider components.
 *
 * Same shape as `composeFeatures`, and used the same way in both places — the
 * production shell folds every feature, a subsystem harness folds the one
 * under test, and neither knows which it is.
 */

import { assert } from '@pkgs/assert-root-shared/singleton';
import { type Component, createResource, type JSX, Show } from 'solid-js';

import type {
  FeatureClient,
  FeatureProvider,
  FeatureProviderModule,
  FeatureRoute,
  FeatureTab,
} from './client';

export type ComposedFeatureClients = {
  readonly featureNames: readonly string[];
  readonly routes: readonly FeatureRoute[];
  /** Tabs in `order`. */
  readonly tabs: readonly FeatureTab[];
  /** Feature chrome, nested outermost-first. Paints above the SQLite gate. */
  readonly Chrome: FeatureProvider;
  /**
   * Feature session providers, nested outermost-first, each loaded on demand.
   * Renders nothing until they resolve — a feature's screens must not mount
   * before the providers they read.
   */
  readonly Session: FeatureProvider;
  /** Docked widgets above the tab bar, in feature order. */
  readonly tabsDocks: readonly Component[];
  readonly settings: readonly Component[];
};

/**
 * Nest providers so the first contributor is outermost — a later feature's
 * provider can read an earlier one's context, and the order is the feature
 * list, which the composition root owns.
 *
 * The nesting is built as thunks rather than values. Solid captures context
 * at the moment JSX is *created*, so materialising the children up front and
 * handing the result to the providers would create them under this
 * component's owner and none of the providers' context would reach them.
 * Calling `child()` in the children position keeps each level lazy, which is
 * what puts the subtree inside the provider above it.
 */
function nest(providers: readonly FeatureProvider[]): FeatureProvider {
  if (providers.length === 0) {
    return (props): JSX.Element => props.children;
  }
  return (props): JSX.Element =>
    providers.reduceRight<() => JSX.Element>(
      (child, Provider) => () => <Provider>{child()}</Provider>,
      () => props.children
    )();
}

/**
 * Same nesting, but each provider arrives on its own chunk.
 *
 * The load starts when the features are folded — once, at a fixed point in
 * the timeline — and not when the tree first renders. Starting it on mount
 * makes the providers arrive after a real module read on a cold cache and
 * after a microtask on a warm one, so the same seed produced a different
 * timeline depending on whether another test had already imported them. That
 * showed up as a spectator's board staying locked: the opponent-animation
 * unlock timer was scheduled on one side of a mount that had moved.
 *
 * Deliberately not `lazy` + `Suspense` either: a suspense boundary here is
 * shared with everything the features render inside it, so a descendant
 * resource re-suspends it and Solid tears the providers down and rebuilds
 * them. `Show` on a resolved signal keeps the providers outside any boundary
 * the subtree can trip.
 */
function nestLazy(
  loaders: readonly (() => Promise<FeatureProviderModule>)[]
): FeatureProvider {
  if (loaders.length === 0) {
    return (props): JSX.Element => props.children;
  }
  const loaded = Promise.all(
    loaders.map(async (load) => (await load()).default)
  );
  return (props): JSX.Element => {
    const [providers] = createResource(() => loaded);
    // Keep the children thunk lazy so each provider owns the subtree it wraps.
    const inner = {
      get children(): JSX.Element {
        return props.children;
      },
    };
    return (
      <Show when={providers()} keyed>
        {(resolved) => nest(resolved)(inner)}
      </Show>
    );
  };
}

function collectRoutes(
  clients: readonly FeatureClient[]
): readonly FeatureRoute[] {
  const byPath = new Map<string, string>();
  const routes: FeatureRoute[] = [];
  for (const client of clients) {
    for (const route of client.routes) {
      const owner = byPath.get(route.path);
      assert.ok(
        owner === undefined,
        `composeFeatureClients: route '${route.path}' is claimed by both '${owner ?? ''}' and '${client.name}'`
      );
      byPath.set(route.path, client.name);
      routes.push(route);
    }
  }
  return routes;
}

function collectTabs(clients: readonly FeatureClient[]): readonly FeatureTab[] {
  const tabs: FeatureTab[] = [];
  for (const client of clients) tabs.push(...(client.tabs ?? []));
  const byOrder = new Map<number, string>();
  for (const tab of tabs) {
    const owner = byOrder.get(tab.order);
    assert.ok(
      owner === undefined,
      `composeFeatureClients: tabs '${owner ?? ''}' and '${tab.name}' both claim position ${String(tab.order)}`
    );
    byOrder.set(tab.order, tab.name);
  }
  return [...tabs].sort((a, b) => a.order - b.order);
}

export function composeFeatureClients(
  clients: readonly FeatureClient[]
): ComposedFeatureClients {
  return {
    featureNames: clients.map((c) => c.name),
    routes: collectRoutes(clients),
    tabs: collectTabs(clients),
    Chrome: nest(clients.flatMap((c) => (c.chrome ? [c.chrome] : []))),
    Session: nestLazy(clients.flatMap((c) => (c.session ? [c.session] : []))),
    tabsDocks: clients.flatMap((c) => (c.tabsDock ? [c.tabsDock] : [])),
    settings: clients.flatMap((c) => (c.settings ? [c.settings] : [])),
  };
}
