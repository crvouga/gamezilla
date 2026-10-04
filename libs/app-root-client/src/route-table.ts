/**
 * The shell's own routes — settings, account, the client inspector, the UI
 * explorer, the OAuth callback. Everything a *feature* owns is contributed by
 * that feature's `FeatureClient` and folded in by `buildRouteTable`.
 *
 * Every screen is lazy so no screen code rides the initial chunk.
 */

import type { FeatureRoute } from '@libs/feature-client/client';
import type { Component } from 'solid-js';

export type RouteScreenModule = { readonly default: Component };

/** A route the router can mount: the shell's own, or a feature's. */
export type AppRouteEntry = FeatureRoute;

/** Routes that belong to the shell itself, not to any bounded context. */
export const SHELL_ROUTE_TABLE: readonly AppRouteEntry[] = [
  { path: '/more', load: () => import('./more') },
  { path: '/more/theme', load: () => import('./more-theme') },
  { path: '/more/performance', load: () => import('./more-performance') },
  { path: '/more/sound', load: () => import('./more-sound') },
  { path: '/more/about', load: () => import('./more-about') },
  { path: '/more/sync', load: () => import('./more-sync') },
  {
    path: '/more/server-status',
    load: () => import('./more-server-status'),
  },
  {
    path: '/more/client-config',
    load: () => import('./more-client-config'),
  },
  { path: '/more/account', load: () => import('./account') },
  {
    path: '/more/account/providers',
    load: () => import('./account-providers'),
  },
  {
    path: '/more/account/devices',
    load: () => import('./account-devices'),
  },
  {
    path: '/more/account/device/:deviceId',
    load: () => import('./account-device'),
  },
  { path: '/client/sql', load: () => import('./client-sql') },
  { path: '/client/events', load: () => import('./client-events') },
  { path: '/ui', load: () => import('./ui-explorer') },
  { path: '/ui/:component', load: () => import('./ui-explorer-detail') },
  { path: '/sso-callback', load: () => import('./sso-callback') },
];

/** Shell routes plus whatever the composed features contribute. */
export function buildRouteTable(
  featureRoutes: readonly AppRouteEntry[]
): readonly AppRouteEntry[] {
  return [...featureRoutes, ...SHELL_ROUTE_TABLE];
}

/** `@solidjs/router` splat for the not-found screen. */
export const NOT_FOUND_ROUTE_PATH = '/*all';

export const loadNotFoundScreen = (): Promise<RouteScreenModule> =>
  import('./not-found');
