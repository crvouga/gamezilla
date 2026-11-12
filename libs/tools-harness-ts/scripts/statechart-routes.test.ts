import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import type { MachineConfig } from '@crvouga/atlas';
import {
  declaredProductRoutes,
  PRODUCT_LINK_SOURCES,
  PRODUCT_ROUTE_ROOTS,
  routeCoverageProblems,
} from './statechart-routes';
import { readTurboTasks } from './turbo-config';

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
          routes: ['/example/:id', '/*all'],
        },
      },
    },
  };
}

describe('declared product route closure', () => {
  test('resolves the actual composition, aliases and shared constants without loading product code', () => {
    const routes = declaredProductRoutes(sources());
    expect(routes.map((route) => route.path)).toEqual([
      '/',
      '/*all',
      '/example/:id',
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
      meta: { routes: ['/more/:id-stats', '/*all'] },
    };
    const owned = { ...chart(), states: { ...chart().states, Detail: detail } };
    expect(routeCoverageProblems(owned, routes)).toEqual([]);
    detail.meta.routes = ['/more/example-stats', '/*all'];
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

  test('rejects route overrides', () => {
    const files = sources();
    files.set(
      PRODUCT_ROUTE_ROOTS[0],
      "export const SHELL_ROUTE_TABLE = [{ path: '/', ...extra }]; export const NOT_FOUND_ROUTE_PATH = '/*all';"
    );
    expect(() => declaredProductRoutes(files)).toThrow('Route object spreads');
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
        problem.message.includes('/*all: no chart state')
      )
    ).toBe(true);
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

// regression: gate-inputs-name-missing-files
test('turbo hashes every source the statechart verification reads', () => {
  const inputs = (
    readTurboTasks(join(import.meta.dirname, '../../..'))[
      '@libs/tools-harness-ts#ci:statecharts'
    ]?.inputs ?? []
  ).map((input) => input.replace('$TURBO_ROOT$/', ''));
  const unhashed = [
    ...PRODUCT_ROUTE_ROOTS,
    ...PRODUCT_LINK_SOURCES,
    'libs/example-client-ts/src/sub-client.tsx',
    'specs/example/example.feature',
    'docs/statecharts/README.md',
  ].filter((path) => !inputs.some((input) => new Bun.Glob(input).match(path)));
  expect(unhashed).toEqual([]);
});
