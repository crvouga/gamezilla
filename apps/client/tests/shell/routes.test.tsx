/** @jsxImportSource solid-js */
import { matchAppRoute } from '@apps/client/routes/match-route-path';
import { APP_ROUTE_TABLE } from '@apps/client/routes/route-table';
import { buildAppRoutes } from '@apps/client/routes/routes';
import { describe, expect, it } from 'vitest';

/** Every path from the RN linking config with params filled in. */
const LINKING_CONFIG_PATHS: readonly string[] = [
  '/',
  '/search',
  '/notifications',
  '/profile',
  '/space/space-1',
  '/profile/edit',
  '/profile/handle',
  '/profile/avatar',
  '/profile/friends',
  '/profile/user/user-1',
  '/more',
  '/more/theme',
  '/more/performance',
  '/more/sound',
  '/more/about',
  '/more/sync',
  '/more/server-status',
  '/more/client-config',
  '/more/account',
  '/more/billing',
  '/more/account/providers',
  '/more/account/devices',
  '/more/account/device/device-1',
  '/ui',
  '/ui/button',
  '/sso-callback',
];

describe('route table', () => {
  it('resolves every linking-config path to a real route (no catch-all)', () => {
    for (const path of LINKING_CONFIG_PATHS) {
      expect(matchAppRoute(path), path).not.toBeNull();
    }
  });

  it('routes unknown paths to the catch-all', () => {
    expect(matchAppRoute('/nope')).toBeNull();
    expect(matchAppRoute('/more/unknown/deep')).toBeNull();
  });

  it('exposes one lazy route per table entry plus the tabs layout and catch-all', () => {
    const routes = buildAppRoutes();
    const tabs = routes[0];
    expect(tabs?.path).toBe('/');
    expect(Array.isArray(tabs?.children) ? tabs.children.length : 0).toBe(4);
    const tabCount = APP_ROUTE_TABLE.filter((e) => e.tab === true).length;
    // tabs layout + stack routes + catch-all
    expect(routes.length).toBe(APP_ROUTE_TABLE.length - tabCount + 2);
    expect(routes.at(-1)?.path).toBe('/*all');
  });

  it('every stub module default-exports a component', async () => {
    for (const entry of APP_ROUTE_TABLE) {
      const mod = await entry.load();
      expect(typeof mod.default, entry.path).toBe('function');
    }
  }, 30_000);
});
