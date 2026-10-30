import { describe, expect, test } from 'bun:test';
import {
  categoryViolations,
  familyMayDependOn,
  familyOf,
  gameApiViolations,
  gameIdentityViolations,
  gameViolations,
} from './package-boundaries';

const lib = { tier: 'libs', sources: [] };

// regression: external-workspace-category
test('upstream workspace packages do not adopt product package categories', () => {
  expect(
    categoryViolations(
      {
        name: '@libs/tools-harness-ts',
        category: 'harness',
        devDependencies: { '@crvouga/atlas': 'workspace:*' },
      },
      { tier: 'libs', sources: [] }
    )
  ).toEqual([]);
  expect(
    categoryViolations(
      {
        name: '@libs/tools-harness-ts',
        category: 'harness',
        devDependencies: { '@pkgs/missing-category': 'workspace:*' },
      },
      { tier: 'libs', sources: [] }
    )
  ).toEqual([
    'devDependencies names @pkgs/missing-category, whose name spells no category',
  ]);
});

describe('package categories', () => {
  test('a package declares a category', () => {
    expect(categoryViolations({ name: '@libs/x-client' }, lib)).toEqual([
      'package.json declares no category (one of client, server, isomorphic, harness)',
    ]);
  });

  test('client and server never meet; isomorphic depends on isomorphic only', () => {
    const deps = (category: string, dep: string) =>
      categoryViolations(
        {
          name: `@libs/x-${category === 'isomorphic' ? 'shared' : category}`,
          category,
          dependencies: { [dep]: 'workspace:*' },
        },
        lib
      );
    expect(deps('client', '@libs/y-server')).toEqual([
      'client package depends on server @libs/y-server',
    ]);
    expect(deps('server', '@libs/y-client')).toEqual([
      'server package depends on client @libs/y-client',
    ]);
    expect(deps('isomorphic', '@libs/y-client')).toEqual([
      'isomorphic package depends on client @libs/y-client',
    ]);
    expect(deps('isomorphic', '@libs/y-server')).toEqual([
      'isomorphic package depends on server @libs/y-server',
    ]);
    expect(deps('client', '@libs/y-shared')).toEqual([]);
    expect(deps('harness', '@libs/y-server')).toEqual([]);
  });

  test('only a harness depends on a harness, even for tests', () => {
    expect(
      categoryViolations(
        {
          name: '@libs/x-client',
          category: 'client',
          devDependencies: { '@libs/y-harness': 'workspace:*' },
        },
        lib
      )
    ).toEqual([
      'devDependencies names harness @libs/y-harness: only a harness depends on a harness',
    ]);
    expect(
      categoryViolations(
        {
          name: '@libs/x-client',
          category: 'client',
          devDependencies: { '@libs/y-server': 'workspace:*' },
        },
        lib
      )
    ).toEqual([]);
  });

  test('isomorphic source loads nothing that runs on one side only', () => {
    const sources = [
      { path: 'src/a.ts', text: "import { createSignal } from 'solid-js';\n" },
      { path: 'src/b.ts', text: "import { readFileSync } from 'node:fs';\n" },
      { path: 'src/c.ts', text: "import type { JSX } from 'solid-js';\n" },
    ];
    expect(
      categoryViolations(
        { name: '@libs/x-shared', category: 'isomorphic' },
        { ...lib, sources }
      )
    ).toEqual([
      'src/a.ts loads solid-js, which does not run everywhere',
      'src/b.ts loads node:fs, which does not run everywhere',
    ]);
  });

  test('families group a sub across its slices', () => {
    expect(familyOf('@libs/chess-puzzle-client-ts')).toBe('chess');
    expect(familyOf('@libs/app-config-shared-ts')).toBe('app-config');
    expect(familyOf('@libs/app-root-client-ts')).toBe('app');
    expect(familyOf('@libs/user-search-client-ts')).toBe('user-search');
    expect(familyOf('@pkgs/ui-root-client-ts')).toBeUndefined();
  });

  test('sub is the algebra family and chess-sub-shared stays chess', () => {
    expect(familyOf('@libs/sub-shared-ts')).toBe('sub');
    expect(familyOf('@libs/sub-client-ts')).toBe('sub');
    expect(familyOf('@libs/chess-sub-shared-ts')).toBe('chess');
    for (const dependency of [
      'billing',
      'chess',
      'friends',
      'games',
      'notifications',
      'profile',
      'search',
      'spaces',
      'user-search',
      'runtime',
      'app',
      'harness',
    ]) {
      expect(familyMayDependOn('sub', dependency)).toBe(false);
    }
    expect(familyMayDependOn('chess', 'sub')).toBe(true);
  });
});

// regression: package-category-source-import-bypass
test('source imports cannot hide a forbidden runtime in devDependencies or syntax', () => {
  const imports = [
    'import { api } from "@libs/y-server/api";',
    'export { api } from "@libs/y-server/api";',
    'const api = import(`@libs/y-server/api`);',
    'const api = require("@libs/y-server/api");',
    'import api = require("@libs/y-server/api");',
  ];
  for (const text of imports) {
    expect(
      categoryViolations(
        {
          name: '@libs/x-client',
          category: 'client',
          devDependencies: { '@libs/y-server': 'workspace:*' },
        },
        { ...lib, sources: [{ path: 'src/index.ts', text }] }
      )
    ).toEqual(['src/index.ts: client source imports server @libs/y-server']);
  }
  expect(
    categoryViolations(
      { name: '@libs/x-client', category: 'client' },
      {
        ...lib,
        sources: [
          {
            path: 'src/index.ts',
            text: '// import "@libs/y-server/api";\nconst text = "require(\\\"@libs/y-server/api\\\")";',
          },
        ],
      }
    )
  ).toEqual([]);
});

test('flat package sources do not grow another layer hierarchy', () => {
  expect(
    categoryViolations(
      { name: '@libs/x-shared', category: 'isomorphic' },
      {
        ...lib,
        sources: [
          { path: 'src/shared/types.ts', text: 'export type Id = string;' },
        ],
      }
    )
  ).toEqual([
    'src/shared/types.ts: src must be flat; split a vertical slice into its own package',
  ]);
});

test('Hono RPC contracts cross the client boundary through erased types only', () => {
  expect(
    categoryViolations(
      {
        name: '@libs/x-client',
        category: 'client',
        devDependencies: { '@libs/y-server': 'workspace:*' },
      },
      {
        ...lib,
        sources: [
          {
            path: 'src/api.ts',
            text: 'import type { AppRPC } from "@libs/y-server/routes";',
          },
        ],
      }
    )
  ).toEqual([]);
});

describe('game isolation', () => {
  const workspace = new Map([
    [
      '@libs/chess-rules-shared-ts',
      { name: '@libs/chess-rules-shared-ts', game: 'chess' },
    ],
    ['@libs/race-shared', { name: '@libs/race-shared', game: 'race' }],
    ['@libs/game-session-shared-ts', { name: '@libs/game-session-shared-ts' }],
    [
      '@libs/games-shared-ts',
      { name: '@libs/games-shared-ts', gameRegistry: true },
    ],
  ]);
  test('a game may use the shared platform and its own packages', () => {
    expect(
      gameViolations(
        {
          name: '@libs/race-client',
          game: 'race',
          dependencies: {
            '@libs/race-shared': 'workspace:*',
            '@libs/game-session-shared-ts': 'workspace:*',
          },
        },
        workspace
      )
    ).toEqual([]);
  });
  test('a game never depends on another game', () => {
    expect(
      gameViolations(
        {
          name: '@libs/race-client',
          game: 'race',
          dependencies: { '@libs/chess-rules-shared-ts': 'workspace:*' },
        },
        workspace
      )
    ).toHaveLength(1);
  });
  test('only a game registry composes concrete games', () => {
    const platform = {
      name: '@libs/game-session-client-ts',
      devDependencies: { '@libs/race-shared': 'workspace:*' },
    };
    expect(gameViolations(platform, workspace)).toHaveLength(1);
    expect(
      gameViolations({ ...platform, gameRegistry: true }, workspace)
    ).toEqual([]);
  });
  test('depending on a registry composes every game, so only a registry may', () => {
    const catalog = {
      name: '@libs/game-catalog-shared-ts',
      dependencies: { '@libs/games-shared-ts': 'workspace:*' },
    };
    expect(gameViolations(catalog, workspace)).toHaveLength(1);
    expect(
      gameViolations({ ...catalog, gameRegistry: true }, workspace)
    ).toEqual([]);
  });
  test('a game never reaches its siblings through a registry', () => {
    expect(
      gameViolations(
        {
          name: '@libs/race-harness',
          game: 'race',
          devDependencies: { '@libs/games-shared-ts': 'workspace:*' },
        },
        workspace
      )
    ).toHaveLength(1);
    expect(
      gameViolations(
        { name: '@libs/race-harness', game: 'race', gameRegistry: true },
        workspace
      )
    ).toHaveLength(1);
  });
  test('a package named for a game declares it', () => {
    expect(gameViolations({ name: '@libs/race-harness' }, workspace)).toEqual([
      '@libs/race-harness is named for the game race; declare "game": "race"',
    ]);
  });
});

describe('the game API', () => {
  const workspace = new Map([
    [
      '@libs/game-session-shared-ts',
      {
        name: '@libs/game-session-shared-ts',
        gameApi: ['game-definition'],
      },
    ],
    [
      '@libs/game-session-server-ts',
      { name: '@libs/game-session-server-ts', gameApi: [] },
    ],
    ['@libs/race-shared', { name: '@libs/race-shared', game: 'race' }],
    ['@pkgs/sql-root-shared-ts', { name: '@pkgs/sql-root-shared-ts' }],
  ]);
  const race = { name: '@libs/race-harness', game: 'race' };
  const imports = (text: string, manifest: object = race) =>
    gameApiViolations(manifest, {
      workspace,
      modules: new Set(),
      sources: [{ path: 'tests/race.test.ts', text }],
    });

  test('a game imports the framework through its public modules', () => {
    // regression: composed-game-api-fixture-keeps-old-name
    expect(
      imports(
        [
          "import { defineGame } from '@libs/game-session-shared-ts/game-definition';",
          "import { raceRules } from '@libs/race-shared/race-rules';",
          "import sql from '@pkgs/sql-root-shared-ts/sql';",
        ].join('\n')
      )
    ).toEqual([]);
  });

  test('a game never imports a framework internal, in source, tests or types', () => {
    for (const text of [
      "import { newCustomGame } from '@libs/game-session-shared-ts/custom-game-state';",
      "import type { CustomGame } from '@libs/game-session-shared-ts/custom-game-state';",
      "export { newCustomGame } from '@libs/game-session-shared-ts/custom-game-state';",
      "const state = await import('@libs/game-session-shared-ts/custom-game-state');",
    ])
      expect(imports(text)).toEqual([
        "tests/race.test.ts: imports @libs/game-session-shared-ts/custom-game-state, which is @libs/game-session-shared-ts's own implementation, not its game API (game-definition). A game depends on what the framework promises: use a public module, add a focused read, action or fixture helper to one, or move a test of the framework's own behaviour into the framework",
      ]);
  });

  test('a framework package offering games nothing refuses every import', () => {
    expect(
      imports(
        "import { createGameSessionServer } from '@libs/game-session-server-ts/sub-server';"
      )
    ).toEqual([
      "tests/race.test.ts: imports @libs/game-session-server-ts/sub-server, which is @libs/game-session-server-ts's own implementation, not its game API (it offers games none). A game depends on what the framework promises: use a public module, add a focused read, action or fixture helper to one, or move a test of the framework's own behaviour into the framework",
    ]);
  });

  test('the framework itself may use its own internals', () => {
    expect(
      imports(
        "import { newCustomGame } from '@libs/game-session-shared-ts/custom-game-state';",
        { name: '@libs/games-harness-ts', gameRegistry: true }
      )
    ).toEqual([]);
  });

  test('a framework package lists only modules it has and is never a game', () => {
    expect(
      gameApiViolations(
        { name: '@libs/game-menu-client-ts', gameApi: ['game-client', 'gone'] },
        { workspace, modules: new Set(['game-client']), sources: [] }
      )
    ).toEqual([
      'gameApi lists "gone", which @libs/game-menu-client-ts does not have (src/gone.ts): list only modules a game may import',
    ]);
    expect(
      gameApiViolations(
        { name: '@libs/race-shared', game: 'race', gameApi: [] },
        { workspace, modules: new Set(), sources: [] }
      )
    ).toEqual([
      '@libs/race-shared is a game of race and declares a game API: only framework packages offer one',
    ]);
  });
});

describe('game identity', () => {
  const gameIds = new Set(['chess', 'race']);
  const scan = (
    text: string,
    manifest = { name: '@libs/game-session-shared-ts' }
  ) =>
    gameIdentityViolations(manifest, {
      gameIds,
      sources: [{ path: 'src/a.ts', text }],
    });
  test('platform code never spells a game id', () => {
    expect(scan("if (game.id === 'race') return null;")).toEqual([
      "src/a.ts:1 spells the game 'race': platform code receives games through the registry's ports and never names one",
    ]);
    expect(scan('const name = `chess`;')).toHaveLength(1);
  });
  test('comments, longer names and the marked durable name are allowed', () => {
    expect(
      scan(
        [
          "// a game such as 'chess'",
          "const table = 'chess_multiplayer_games';",
          "export const NAMESPACE = 'chess'; // @durable-name",
        ].join('\n')
      )
    ).toEqual([]);
  });
  test('a game and a registry may name games', () => {
    expect(
      scan("const id = 'chess';", {
        name: '@libs/chess-rules-shared-ts',
        game: 'chess',
      } as never)
    ).toEqual([]);
    expect(
      scan("const id = 'race';", {
        name: '@libs/games-shared-ts',
        gameRegistry: true,
      } as never)
    ).toEqual([]);
  });
});

test('UI component slices keep stories and local styles beside a JSX entrypoint', () => {
  const manifest = { name: '@pkgs/ui-client-ts', category: 'client' };
  const sources = [
    {
      path: 'src/button/index.tsx',
      text: 'export function Button() { return <button />; }',
    },
    {
      path: 'src/button/button.stories.tsx',
      text: 'export const Disabled = {};',
    },
  ];
  expect(categoryViolations(manifest, { tier: 'pkgs', sources })).toEqual([]);
  expect(
    categoryViolations(manifest, { tier: 'pkgs', sources: [sources[1]!] })
  ).toEqual([
    'src/button/button.stories.tsx: src must be flat; split a vertical slice into its own package',
  ]);
});
