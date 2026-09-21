/** @jsxImportSource solid-js */
/**
 * `@solidjs/router` route definitions built from `APP_ROUTE_TABLE`. Tab roots
 * nest under `TabsLayout`; everything else is a top-level route; `/*all` is
 * the not-found stub. Each screen is `lazy` so no screen code is in the
 * initial chunk.
 */

import type { RouteDefinition } from '@solidjs/router';
import { lazy } from 'solid-js';

import {
  APP_ROUTE_TABLE,
  type AppRouteEntry,
  loadNotFoundScreen,
  NOT_FOUND_ROUTE_PATH,
} from './route-table';
import { TabsLayout } from './tabs-layout';

function toRoute(entry: AppRouteEntry): RouteDefinition {
  return { path: entry.path, component: lazy(entry.load) };
}

export function buildAppRoutes(): RouteDefinition[] {
  const tabRoutes = APP_ROUTE_TABLE.filter((entry) => entry.tab === true);
  const stackRoutes = APP_ROUTE_TABLE.filter((entry) => entry.tab !== true);
  return [
    { path: '/', component: TabsLayout, children: tabRoutes.map(toRoute) },
    ...stackRoutes.map(toRoute),
    { path: NOT_FOUND_ROUTE_PATH, component: lazy(loadNotFoundScreen) },
  ];
}
