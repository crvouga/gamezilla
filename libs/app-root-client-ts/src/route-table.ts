import AccountScreen from './account';
import AccountDeviceScreen from './account-device';
import AccountDevicesScreen from './account-devices';
import AccountProvidersScreen from './account-providers';
import ClientEventsScreen from './client-events';
import ClientSqlScreen from './client-sql';
import MoreScreen from './more';
import MoreAboutScreen from './more-about';
import MoreClientConfigScreen from './more-client-config';
import MorePerformanceScreen from './more-performance';
import MoreServerStatusScreen from './more-server-status';
import MoreSoundScreen from './more-sound';
import MoreSyncScreen from './more-sync';
import MoreThemeScreen from './more-theme';
import SsoCallbackScreen from './sso-callback';
/**
 * The shell's own routes — settings, account, the client inspector, the OAuth callback. Everything a *sub* owns is contributed by
 * that sub's `SubClient` and folded in by `buildRouteTable`.
 *
 * Every screen is imported before navigation.
 */

import type { SubRoute } from '@libs/sub-client-ts/client';

/** A route the router can mount: the shell's own, or a sub's. */
export type AppRouteEntry = SubRoute;

/** Routes that belong to the shell itself, not to any bounded context. */
export const SHELL_ROUTE_TABLE: readonly AppRouteEntry[] = [
  { path: '/more', component: MoreScreen },
  { path: '/more/theme', component: MoreThemeScreen },
  { path: '/more/performance', component: MorePerformanceScreen },
  { path: '/more/sound', component: MoreSoundScreen },
  { path: '/more/about', component: MoreAboutScreen },
  { path: '/more/sync', component: MoreSyncScreen },
  {
    path: '/more/server-status',
    component: MoreServerStatusScreen,
  },
  {
    path: '/more/client-config',
    component: MoreClientConfigScreen,
  },
  { path: '/more/account', component: AccountScreen },
  {
    path: '/more/account/providers',
    component: AccountProvidersScreen,
  },
  {
    path: '/more/account/devices',
    component: AccountDevicesScreen,
  },
  {
    path: '/more/account/device/:deviceId',
    component: AccountDeviceScreen,
  },
  { path: '/client/sql', component: ClientSqlScreen },
  { path: '/client/events', component: ClientEventsScreen },
  { path: '/sso-callback', component: SsoCallbackScreen },
];

/** Shell routes plus whatever the composed subs contribute. */
export function buildRouteTable(
  subRoutes: readonly AppRouteEntry[]
): readonly AppRouteEntry[] {
  return [...subRoutes, ...SHELL_ROUTE_TABLE];
}

/** `@solidjs/router` splat for the not-found screen. */
export const NOT_FOUND_ROUTE_PATH = '/*all';
