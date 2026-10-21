import { describe, expect, test } from 'bun:test';
import type { MachineConfig } from '@crvouga/atlas';
import {
  declaredProductRoutes,
  PRODUCT_ROUTE_ROOTS,
  routeCoverageProblems,
} from './statechart-routes';

function sources(): Map<string, string> {
  return new Map([
    [
      PRODUCT_ROUTE_ROOTS[0],
      `
      const HOME = '/';
      // { path: '/comment-only' }
      export const SHELL_ROUTE_TABLE = [{ path: HOME, component: Home }];
      export const NOT_FOUND_ROUTE_PATH = '/*all';
    `,
    ],
    [
      PRODUCT_ROUTE_ROOTS[1],
      `
      import { CLIENT as ACTIVE } from '@libs/example-client/sub-client';
      import { UNUSED } from '@libs/uncomposed-client/sub-client';
      const ACTIVE_CLIENTS = [ACTIVE];
      export const APP_SUB_CLIENTS = [...ACTIVE_CLIENTS];
    `,
    ],
    [
      'libs/example-client/src/sub-client.tsx',
      `
      import { defineSubClient as define } from '@libs/sub-client-ts/client';
      import { DETAIL } from '@libs/example-shared/paths';
      const ROUTES = [{ path: DETAIL, component: Detail }];
      export const CLIENT = define({ name: 'example', routes: ROUTES });
    `,
    ],
    [
      'libs/example-shared/src/paths.ts',
      "export const DETAIL = '/example/:id';",
    ],
    [
      PRODUCT_ROUTE_ROOTS[2],
      `
      import { HARNESS_PATH } from './console-nav-real';
      function isHarnessPath(pathname: string) {
        return pathname === HARNESS_PATH || pathname.startsWith(HARNESS_PATH + '/');
      }
      function surfaceAt(pathname: string) {
        if (isHarnessPath(pathname)) return 'harness';
        return 'app';
      }
    `,
    ],
    [PRODUCT_ROUTE_ROOTS[3], "export const HARNESS_PATH = '/harness';"],
  ]);
}

function chart(): MachineConfig {
  return {
    id: 'product',
    initial: 'Home',
    states: {
      Home: { meta: { route: '/' } },
      Detail: {
        meta: {
          routes: ['/example/:id', '/*all', '/harness'],
        },
      },
    },
  };
}

describe('declared product route closure', () => {
  test('resolves the actual composition, aliases, shared constants and surface patterns without loading product code', () => {
    const routes = declaredProductRoutes(sources());
    expect(routes.map((route) => route.path)).toEqual([
      '/',
      '/*all',
      '/example/:id',
      '/harness',
    ]);
    expect(routes.find((route) => route.path === '/example/:id')?.source).toBe(
      'libs/example-client/src/sub-client.tsx'
    );
    expect(routeCoverageProblems(chart(), routes)).toEqual([]);
  });

  test('finds routes returned by a composed sub factory', () => {
    const files = sources();
    files.set(
      PRODUCT_ROUTE_ROOTS[1],
      `
      import { createClient } from '@libs/example-client/sub-client';
      const ACTIVE = createClient({ ports: injectedPorts });
      export const APP_SUB_CLIENTS = [ACTIVE];
    `
    );
    files.set(
      'libs/example-client/src/sub-client.tsx',
      `
      import { defineSubClient } from '@libs/sub-client-ts/client';
      export function createClient(options) {
        function Provider() { return options.children; }
        return defineSubClient({ name: 'example', routes: [{ path: '/factory/:id' }] });
      }
    `
    );
    expect(
      declaredProductRoutes(files).some(
        (route) => route.path === '/factory/:id'
      )
    ).toBe(true);
  });

  // regression: statechart-mapped-client-route-family
  test('finds the route family returned by a composed client-array factory', () => {
    const files = sources();
    files.set(
      PRODUCT_ROUTE_ROOTS[1],
      `
      import { createClients } from '@libs/example-client/sub-client';
      export const APP_SUB_CLIENTS = [...createClients(registeredClients)];
    `
    );
    files.set(
      'libs/example-client/src/sub-client.tsx',
      `
      import { defineSubClient } from '@libs/sub-client-ts/client';
      function statsClient(game) {
        const path = \`/more/\${game.id}-stats\`;
        return defineSubClient({ name: 'stats', routes: [{ path }] });
      }
      export function createClients(games) {
        return games.flatMap((game) => game.puzzles === undefined ? [] : [statsClient(game)]);
      }
    `
    );
    const routes = declaredProductRoutes(files);
    expect(routes).toContainEqual({
      path: '/more/:id-stats',
      source: 'libs/example-client/src/sub-client.tsx',
    });
    const detail = {
      meta: { routes: ['/more/:id-stats', '/*all', '/harness'] },
    };
    const owned = { ...chart(), states: { ...chart().states, Detail: detail } };
    expect(routeCoverageProblems(owned, routes)).toEqual([]);
    detail.meta.routes = ['/more/example-stats', '/*all', '/harness'];
    expect(
      routeCoverageProblems(owned, routes).some((issue) =>
        issue.message.includes('no chart state owns')
      )
    ).toBe(true);
    const factory = files.get('libs/example-client/src/sub-client.tsx')!;
    files.set(
      'libs/example-client/src/sub-client.tsx',
      factory.replaceAll('game', 'client')
    );
    expect(declaredProductRoutes(files)).toEqual(routes);
    files.set(
      'libs/example-client/src/sub-client.tsx',
      factory.replace('game.id', 'process.env.ROUTE')
    );
    expect(() => declaredProductRoutes(files)).toThrow('static pattern');
  });

  test('rejects cyclic client-array factories', () => {
    const files = sources();
    files.set(
      PRODUCT_ROUTE_ROOTS[1],
      `
      function createClients() { return createClients(); }
      export const APP_SUB_CLIENTS = [...createClients()];
    `
    );
    expect(() => declaredProductRoutes(files)).toThrow('Cyclic route factory');
  });

  test('rejects a dynamic route instead of treating a template as a complete declaration', () => {
    const files = sources();
    files.set(
      'libs/example-shared/src/paths.ts',
      'export const DETAIL = `/example/${process.env.ROUTE}`;'
    );
    expect(() => declaredProductRoutes(files)).toThrow('static pattern');
    files.set(
      'libs/example-shared/src/paths.ts',
      'export const DETAIL = unknownPath;'
    );
    expect(() => declaredProductRoutes(files)).toThrow(
      'Unresolved route binding'
    );
  });

  test('rejects missing dependencies, syntax errors and duplicate registered paths', () => {
    const files = sources();
    files.delete('libs/example-shared/src/paths.ts');
    expect(() => declaredProductRoutes(files)).toThrow(
      'Missing route dependency'
    );
    files.set('libs/example-shared/src/paths.ts', 'export const DETAIL = ;');
    expect(() => declaredProductRoutes(files)).toThrow(
      'Invalid route source syntax'
    );
    files.set('libs/example-shared/src/paths.ts', "export const DETAIL = '/';");
    expect(() => declaredProductRoutes(files)).toThrow(
      'Duplicate public route pattern'
    );
  });

  test('rejects route overrides and unrecognized product surfaces', () => {
    const files = sources();
    files.set(
      PRODUCT_ROUTE_ROOTS[0],
      "export const SHELL_ROUTE_TABLE = [{ path: '/', ...extra }]; export const NOT_FOUND_ROUTE_PATH = '/*all';"
    );
    expect(() => declaredProductRoutes(files)).toThrow('Route object spreads');
    files.set(PRODUCT_ROUTE_ROOTS[0], sources().get(PRODUCT_ROUTE_ROOTS[0])!);
    files.set(
      PRODUCT_ROUTE_ROOTS[2],
      sources()
        .get(PRODUCT_ROUTE_ROOTS[2])!
        .replace(
          "return 'app';",
          "if (isSimulatorPath(pathname)) return 'simulator'; return 'app';"
        )
    );
    expect(() => declaredProductRoutes(files)).toThrow(
      'declare every public surface'
    );
  });

  test('reports unowned and invented screen addresses while allowing several outcomes on one route', () => {
    const machine = chart();
    machine.states!['Another outcome'] = { meta: { route: '/' } };
    const routes = declaredProductRoutes(sources());
    expect(routeCoverageProblems(machine, routes)).toEqual([]);
    machine.states!['Detail']!.meta!['routes'] = ['/example/:id', '/invented'];
    const problems = routeCoverageProblems(machine, routes);
    expect(
      problems.some((problem) =>
        problem.message.includes('undeclared public route /invented')
      )
    ).toBe(true);
    expect(
      problems.some((problem) =>
        problem.message.includes('/harness: no chart state')
      )
    ).toBe(true);
  });

  test('detects additional literal top-level addresses and rejects unresolved path predicates', () => {
    const files = sources();
    const original = files.get(PRODUCT_ROUTE_ROOTS[2])!;
    files.set(
      PRODUCT_ROUTE_ROOTS[2],
      original.replace(
        'pathname === HARNESS_PATH ||',
        "pathname === '/simulator' || pathname === HARNESS_PATH ||"
      )
    );
    const routes = declaredProductRoutes(files);
    expect(routes.some((route) => route.path === '/simulator')).toBe(true);
    expect(
      routeCoverageProblems(chart(), routes).some((problem) =>
        problem.message.includes('/simulator: no chart state')
      )
    ).toBe(true);
    files.set(
      PRODUCT_ROUTE_ROOTS[2],
      original.replace(
        'pathname === HARNESS_PATH || pathname.startsWith(HARNESS_PATH +',
        'pathname === unknownRoute || pathname.startsWith(HARNESS_PATH +'
      )
    );
    expect(() => declaredProductRoutes(files)).toThrow(
      'Unresolved route binding'
    );
  });

  test('rejects malformed or repeated metadata instead of accepting it as route coverage', () => {
    const machine = chart();
    machine.states!['Home']!.meta!['routes'] = ['/', 5];
    const problems = routeCoverageProblems(
      machine,
      declaredProductRoutes(sources())
    );
    expect(
      problems.some((problem) =>
        problem.message.includes('routes must contain non-empty strings')
      )
    ).toBe(true);
    expect(
      problems.some((problem) =>
        problem.message.includes('duplicate route metadata')
      )
    ).toBe(true);
  });
});
