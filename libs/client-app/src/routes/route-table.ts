/**
 * The shell's own routes — settings, account, the client inspector, the UI
 * explorer, the OAuth callback. Everything a *feature* owns is contributed by
 * that feature's `FeatureClient` and folded in by `buildRouteTable`.
 *
 * Every screen is lazy so no screen code rides the initial chunk.
 */

import type { FeatureRoute } from '@libs/feature/public/client';
import type { Component } from 'solid-js';

export type RouteScreenModule = { readonly default: Component };

/** A route the router can mount: the shell's own, or a feature's. */
export type AppRouteEntry = FeatureRoute;

/** Routes that belong to the shell itself, not to any bounded context. */
export const SHELL_ROUTE_TABLE: readonly AppRouteEntry[] = [
  { path: '/more', load: () => import('./stubs/more') },
  { path: '/more/theme', load: () => import('./stubs/more-theme') },
  { path: '/more/performance', load: () => import('./stubs/more-performance') },
  { path: '/more/sound', load: () => import('./stubs/more-sound') },
  { path: '/more/about', load: () => import('./stubs/more-about') },
  { path: '/more/sync', load: () => import('./stubs/more-sync') },
  {
    path: '/more/server-status',
    load: () => import('./stubs/more-server-status'),
  },
  {
    path: '/more/client-config',
    load: () => import('./stubs/more-client-config'),
  },
  { path: '/more/account', load: () => import('./stubs/account') },
  { path: '/more/billing', load: () => import('./stubs/billing') },
  {
    path: '/more/account/providers',
    load: () => import('./stubs/account-providers'),
  },
  {
    path: '/more/account/devices',
    load: () => import('./stubs/account-devices'),
  },
  {
    path: '/more/account/device/:deviceId',
    load: () => import('./stubs/account-device'),
  },
  { path: '/client/sql', load: () => import('./stubs/client-sql') },
  { path: '/client/events', load: () => import('./stubs/client-events') },
  { path: '/ui', load: () => import('./stubs/ui-explorer') },
  { path: '/ui/:component', load: () => import('./stubs/ui-explorer-detail') },
  { path: '/sso-callback', load: () => import('./stubs/sso-callback') },
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
  import('./stubs/not-found');
