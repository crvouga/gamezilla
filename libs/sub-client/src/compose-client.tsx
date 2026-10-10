/** @jsxImportSource solid-js */
/**
 * The client half of the fold: a set of {@link SubClient}s becomes one
 * route table, one tab bar and two nested provider components.
 *
 * Same shape as `composeSubs`, and used the same way in both places — the
 * production shell folds every sub, a subsystem harness folds the one
 * under test, and neither knows which it is. A node is ordered before the
 * subs it contains.
 */

import { flattenSubs } from '@libs/sub-shared/flatten';
import { assert } from '@pkgs/assert-root-shared/singleton';
import type { Component, JSX } from 'solid-js';

import type { SubClient, SubProvider, SubRoute, SubTab } from './client';

export type ComposedSubClients = {
  readonly subNames: readonly string[];
  readonly routes: readonly SubRoute[];
  /** Tabs in `order`. */
  readonly tabs: readonly SubTab[];
  /** Sub chrome, nested outermost-first. Paints above the SQLite gate. */
  readonly Chrome: SubProvider;
  /** Sub session providers, nested outermost-first. */
  readonly Session: SubProvider;
  /** Docked widgets above the tab bar, in walk order. */
  readonly tabsDocks: readonly Component[];
  readonly settings: readonly Component[];
};

/**
 * Nest providers so the first contributor is outermost — a later sub's
 * provider can read an earlier one's context, and the order is the walked
 * list, which the composition root owns.
 *
 * The nesting is built as thunks rather than values. Solid captures context
 * at the moment JSX is *created*, so materialising the children up front and
 * handing the result to the providers would create them under this
 * component's owner and none of the providers' context would reach them.
 * Calling `child()` in the children position keeps each level lazy, which is
 * what puts the subtree inside the provider above it.
 */
function nest(providers: readonly SubProvider[]): SubProvider {
  if (providers.length === 0) {
    return (props): JSX.Element => props.children;
  }
  return (props): JSX.Element =>
    providers.reduceRight<() => JSX.Element>(
      (child, Provider) => () => <Provider>{child()}</Provider>,
      () => props.children
    )();
}

function collectRoutes(clients: readonly SubClient[]): readonly SubRoute[] {
  const byPath = new Map<string, string>();
  const routes: SubRoute[] = [];
  for (const client of clients) {
    for (const route of client.routes) {
      const owner = byPath.get(route.path);
      assert.ok(
        owner === undefined,
        `composeSubClients: route '${route.path}' is claimed by both '${owner ?? ''}' and '${client.name}'`
      );
      byPath.set(route.path, client.name);
      routes.push(route);
    }
  }
  return routes;
}

function collectTabs(clients: readonly SubClient[]): readonly SubTab[] {
  const tabs: SubTab[] = [];
  for (const client of clients) tabs.push(...(client.tabs ?? []));
  const byOrder = new Map<number, string>();
  for (const tab of tabs) {
    const owner = byOrder.get(tab.order);
    assert.ok(
      owner === undefined,
      `composeSubClients: tabs '${owner ?? ''}' and '${tab.name}' both claim position ${String(tab.order)}`
    );
    byOrder.set(tab.order, tab.name);
  }
  return [...tabs].sort((a, b) => a.order - b.order);
}

export function composeSubClients(
  clients: readonly SubClient[]
): ComposedSubClients {
  const subs = flattenSubs(clients, 'composeSubClients');
  return {
    subNames: subs.map((c) => c.name),
    routes: collectRoutes(subs),
    tabs: collectTabs(subs),
    Chrome: nest(subs.flatMap((c) => (c.chrome ? [c.chrome] : []))),
    Session: nest(subs.flatMap((c) => (c.session ? [c.session] : []))),
    tabsDocks: subs.flatMap((c) => (c.tabsDock ? [c.tabsDock] : [])),
    settings: subs.flatMap((c) => (c.settings ? [c.settings] : [])),
  };
}
