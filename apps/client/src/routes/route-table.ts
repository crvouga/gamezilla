/**
 * Data half of the route table: every path from the RN linking config
 * (`apps/client/src/navigation/types.ts` `appLinking.config`) plus the
 * catch-all. `routes.tsx` turns this into `@solidjs/router` definitions.
 * Every screen is a lazy `RouteStub` until its Solid port lands.
 */

import type { Component } from 'solid-js';

export type RouteScreenModule = { readonly default: Component };

export type AppRouteEntry = {
  /** `@solidjs/router` path pattern (`:param` segments). */
  readonly path: string;
  readonly load: () => Promise<RouteScreenModule>;
  /** Renders inside `TabsLayout` (bottom tab bar on compact). */
  readonly tab?: true | undefined;
};

export const APP_ROUTE_TABLE: readonly AppRouteEntry[] = [
  { path: '/', tab: true, load: () => import('./stubs/spaces') },
  { path: '/search', tab: true, load: () => import('./stubs/search') },
  {
    path: '/notifications',
    tab: true,
    load: () => import('./stubs/notifications'),
  },
  { path: '/profile', tab: true, load: () => import('./stubs/profile') },
  { path: '/space/:id', load: () => import('./stubs/space') },
  { path: '/profile/edit', load: () => import('./stubs/profile-edit') },
  { path: '/profile/handle', load: () => import('./stubs/profile-handle') },
  { path: '/profile/avatar', load: () => import('./stubs/profile-avatar') },
  { path: '/profile/friends', load: () => import('./stubs/profile-friends') },
  { path: '/profile/user/:userId', load: () => import('./stubs/friend-user') },
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

/** Catch-all pattern (`@solidjs/router` splat). */
export const NOT_FOUND_ROUTE_PATH = '/*all';

export const loadNotFoundScreen = (): Promise<RouteScreenModule> =>
  import('./stubs/not-found');
