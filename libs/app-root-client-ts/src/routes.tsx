/** @jsxImportSource @solidjs/web */
/**
 * `@solidjs/router` route definitions built from the composed route table.
 * Tab roots nest under `TabsLayout`; everything else is a top-level route;
 * `/*all` is the not-found stub. Screens are available before navigation.
 */

import type { RouteDefinition } from '@solidjs/router';
import NotFoundScreen from './not-found';

import type { AppRouteEntry } from './route-table';
import { NOT_FOUND_ROUTE_PATH } from './route-table';
import { TabsLayout } from './tabs-layout';

/** A route of the composed app: a screen, or the tab layout around its roots. */
export type AppRouteDefinition = Omit<RouteDefinition, 'children'> & {
  readonly children?: readonly AppRouteDefinition[] | undefined;
};

function toRoute(entry: AppRouteEntry): AppRouteDefinition {
  return { path: entry.path, component: entry.component };
}

export function buildAppRoutes(
  table: readonly AppRouteEntry[]
): AppRouteDefinition[] {
  const tabRoutes = table.filter((entry) => entry.tab === true);
  const stackRoutes = table.filter((entry) => entry.tab !== true);
  return [
    { path: '/', component: TabsLayout, children: tabRoutes.map(toRoute) },
    ...stackRoutes.map(toRoute),
    { path: NOT_FOUND_ROUTE_PATH, component: NotFoundScreen },
  ];
}
