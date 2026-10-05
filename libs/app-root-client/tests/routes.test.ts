import { describe, expect, it } from 'bun:test';
import { matchAppRoute } from '@libs/app-root-client/match-route-path';
import NotFoundScreen from '@libs/app-root-client/not-found';
import {
  buildRouteTable,
  SHELL_ROUTE_TABLE,
} from '@libs/app-root-client/route-table';
import { buildAppRoutes } from '@libs/app-root-client/routes';
import type { FeatureRoute } from '@libs/feature-client/client';

/** Paths the shell owns regardless of which features are composed in. */
const SHELL_PATHS: readonly string[] = [
  '/more',
  '/more/theme',
  '/more/performance',
  '/more/sound',
  '/more/about',
  '/more/sync',
  '/more/server-status',
  '/more/client-config',
  '/more/account',
  '/more/account/providers',
  '/more/account/devices',
  '/more/account/device/device-1',
  '/client/sql',
  '/client/events',
  '/ui',
  '/ui/button',
  '/sso-callback',
];

const FAKE_TAB: FeatureRoute = {
  path: '/fake',
  tab: true,
  component: NotFoundScreen,
};

const FAKE_STACK: FeatureRoute = {
  path: '/fake/:id',
  component: NotFoundScreen,
};

describe('route table', () => {
  it('resolves every shell path to a real route (no catch-all)', () => {
    const table = buildRouteTable([]);
    for (const path of SHELL_PATHS) {
      expect(matchAppRoute(table, path), path).not.toBeNull();
    }
  });

  it('routes unknown paths to the catch-all', () => {
    const table = buildRouteTable([]);
    expect(matchAppRoute(table, '/nope')).toBeNull();
    expect(matchAppRoute(table, '/more/unknown/deep')).toBeNull();
  });

  it('mounts what the composed features contributed, and nothing more', () => {
    const empty = buildRouteTable([]);
    expect(matchAppRoute(empty, '/fake')).toBeNull();
    const withFeature = buildRouteTable([FAKE_TAB, FAKE_STACK]);
    expect(matchAppRoute(withFeature, '/fake')).not.toBeNull();
    expect(matchAppRoute(withFeature, '/fake/7')).not.toBeNull();
  });

  it('nests tab routes under the layout and ends with the catch-all', () => {
    const routes = buildAppRoutes(buildRouteTable([FAKE_TAB, FAKE_STACK]));
    const tabs = routes[0];
    expect(tabs?.path).toBe('/');
    expect(Array.isArray(tabs?.children) ? tabs.children.length : 0).toBe(1);
    // tabs layout + shell stack routes + the feature stack route + catch-all
    expect(routes.length).toBe(SHELL_ROUTE_TABLE.length + 3);
    expect(routes.at(-1)?.path).toBe('/*all');
  });

  // regression: lazy-route-navigation
  it('mounts the contributed component directly without a loading boundary', () => {
    const routes = buildAppRoutes([FAKE_TAB, FAKE_STACK]);
    const tabs = routes[0]?.children;
    expect(Array.isArray(tabs) ? tabs[0]?.component : undefined).toBe(
      FAKE_TAB.component
    );
    expect(routes[1]?.component).toBe(FAKE_STACK.component);
  });

  it('every shell route has an eager component', () => {
    for (const entry of SHELL_ROUTE_TABLE) {
      expect(typeof entry.component, entry.path).toBe('function');
    }
  }, 30_000);
});
