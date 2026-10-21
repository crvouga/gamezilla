import { expect, test } from 'bun:test';
import { readFileSync, realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { build, type Plugin } from 'vite';

const CLIENT = realpathSync(join(import.meta.dir, '..'));
const ROOT = realpathSync(join(CLIENT, '../..'));

/** Check resolved source ownership before Vite can transform or tree-shake it. */
function withoutProductionGames(): Plugin {
  const owners = new Map<string, string>();
  for (const path of new Bun.Glob('{libs,pkgs,apps}/*/package.json').scanSync(
    ROOT
  )) {
    const owner = JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as {
      readonly name: string;
      readonly game?: string;
      readonly gameRegistry?: boolean;
    };
    if (owner.game !== undefined || owner.gameRegistry === true)
      owners.set(path.slice(0, -'package.json'.length), owner.name);
  }
  return {
    name: 'no-production-game-sources',
    enforce: 'pre',
    load(id) {
      if (id.startsWith('\0')) return;
      const path = relative(ROOT, realpathSync(id.split('?')[0]!));
      const directory = /^(libs|pkgs|apps)\/[^/]+\//.exec(path)?.[0];
      if (directory === undefined) return;
      const owner = owners.get(directory);
      // Only this test's entry is permitted in the application package.
      if (path === 'apps/client-ts/tests/isolated-game-framework.ts') return;
      if (owner !== undefined)
        throw new Error(`ISOLATED_CLIENT_FORBIDDEN_GAME: ${owner}`);
    },
  };
}

async function isolatedBuild(entry: string) {
  return build({
    configFile: join(CLIENT, 'vite.config.mts'),
    plugins: [withoutProductionGames()],
    logLevel: 'silent',
    build: {
      write: false,
      rollupOptions: {
        input: entry,
        // Keep the public exports and their screen implementations in the output.
        preserveEntrySignatures: 'strict',
      },
    },
  });
}

// regression: personal-stats-isolated-client-build
test('the shared game screens compile with the production web toolchain and no game plugins', async () => {
  const result = await isolatedBuild(
    join(import.meta.dir, 'isolated-game-framework.ts')
  );
  expect(Array.isArray(result)).toBe(false);
  if (Array.isArray(result) || 'close' in result)
    throw new Error('The isolated build must produce one completed bundle');
  const chunks = result.output.filter((output) => output.type === 'chunk');
  const modules = chunks.flatMap((chunk) => Object.keys(chunk.modules));
  for (const screen of [
    'game-menu-client-ts/src/game-menu.tsx',
    'game-menu-client-ts/src/personal-puzzle-stats-clients.tsx',
    'game-session-client-ts/src/custom-game-screen.tsx',
    'game-session-client-ts/src/game-history.tsx',
    'game-matchmaking-client-ts/src/multiplayer-screen.tsx',
    'game-puzzle-client-ts/src/puzzle-play-screen.tsx',
    'game-puzzle-client-ts/src/puzzle-review-screen.tsx',
    'game-puzzle-client-ts/src/puzzle-stats-screen.tsx',
    'game-puzzle-client-ts/src/personal-puzzle-stats-screen.tsx',
  ])
    expect(
      modules.some((id) => id.endsWith(`/libs/${screen}`)),
      screen
    ).toBe(true);
  expect(chunks.flatMap((chunk) => chunk.exports)).toContain('GameMenu');
  expect(chunks.flatMap((chunk) => chunk.exports)).toContain('games');
  expect(chunks.flatMap((chunk) => chunk.exports)).toContain(
    'createPersonalPuzzleStatsClients'
  );
}, 120_000);

test('the production web build rejects a game implementation without going through a registry', async () => {
  const manifest = [
    ...new Bun.Glob('{libs,pkgs}/*/package.json').scanSync(ROOT),
  ]
    .sort()
    .find(
      (path) =>
        (
          JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as {
            readonly game?: string;
          }
        ).game !== undefined
    );
  expect(manifest).toBeDefined();
  const directory = join(ROOT, manifest!, '..');
  const source = [...new Bun.Glob('src/*.{ts,tsx}').scanSync(directory)]
    .sort()
    .find((path) => !path.endsWith('.d.ts'));
  expect(source).toBeDefined();
  await expect(isolatedBuild(join(directory, source!))).rejects.toThrow(
    'ISOLATED_CLIENT_FORBIDDEN_GAME:'
  );
}, 120_000);

test('the production web build rejects a concrete registry before tree-shaking', async () => {
  await expect(
    isolatedBuild(join(ROOT, 'libs/games-client-ts/src/game-plugins.client.ts'))
  ).rejects.toThrow('ISOLATED_CLIENT_FORBIDDEN_GAME: @libs/games-client-ts');
}, 120_000);
