/** @jsxImportSource solid-js */
/**
 * `@solidjs/router` route definitions built from the composed route table.
 * Tab roots nest under `TabsLayout`; everything else is a top-level route;
 * `/*all` is the not-found stub. Each screen is `lazy` so no screen code is
 * in the initial chunk.
 */

import type { RouteDefinition } from '@solidjs/router';
import { lazy } from 'solid-js';

import type { AppRouteEntry } from './route-table';
import { loadNotFoundScreen, NOT_FOUND_ROUTE_PATH } from './route-table';
import { TabsLayout } from './tabs-layout';

function toRoute(entry: AppRouteEntry): RouteDefinition {
  return { path: entry.path, component: lazy(entry.load) };
}

export function buildAppRoutes(
  table: readonly AppRouteEntry[]
): RouteDefinition[] {
  const tabRoutes = table.filter((entry) => entry.tab === true);
  const stackRoutes = table.filter((entry) => entry.tab !== true);
  return [
    { path: '/', component: TabsLayout, children: tabRoutes.map(toRoute) },
    ...stackRoutes.map(toRoute),
    { path: NOT_FOUND_ROUTE_PATH, component: lazy(loadNotFoundScreen) },
  ];
}
