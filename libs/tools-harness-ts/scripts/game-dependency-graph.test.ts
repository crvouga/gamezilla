import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { forbiddenGamePaths, type GamePackage } from './game-dependency-graph';
import { gameApiViolations, gameViolations } from './package-boundaries';

const ROOT = join(import.meta.dir, '../../..');

function workspaceManifests(): ReadonlyMap<string, GamePackage> {
  const manifests = [
    ...new Bun.Glob('{libs,pkgs,apps}/*/package.json').scanSync(ROOT),
  ]
    .sort()
    .map(
      (file) =>
        JSON.parse(readFileSync(join(ROOT, file), 'utf8')) as GamePackage
    );
  return new Map(manifests.map((manifest) => [manifest.name, manifest]));
}

test('every framework package and each independent game has no forbidden transitive dependency', () => {
  const workspace = workspaceManifests();
  expect(workspace.size).toBeGreaterThan(0);
  const paths = [...workspace.values()].flatMap((manifest) =>
    forbiddenGamePaths(manifest, workspace)
  );
  expect(paths).toEqual([]);
});

test('an intermediary or a cycle cannot conceal a concrete game or registry', () => {
  const framework: GamePackage = {
    name: '@libs/framework-shared',
    dependencies: { '@libs/helper-shared': 'workspace:*' },
  };
  const helper: GamePackage = {
    name: '@libs/helper-shared',
    devDependencies: {
      [framework.name]: 'workspace:*',
      '@pkgs/engine-shared': 'workspace:*',
      '@libs/registry-shared': 'workspace:*',
    },
  };
  const engine: GamePackage = {
    name: '@pkgs/engine-shared',
    game: 'reference',
  };
  const registry: GamePackage = {
    name: '@libs/registry-shared',
    gameRegistry: true,
  };
  const workspace = new Map(
    [framework, helper, engine, registry].map((manifest) => [
      manifest.name,
      manifest,
    ])
  );
  expect(forbiddenGamePaths(framework, workspace)).toEqual([
    [framework.name, helper.name, registry.name],
    [framework.name, helper.name, engine.name],
  ]);
  expect(forbiddenGamePaths(registry, workspace)).toEqual([]);
});

// regression: concrete-engine-game-ownership
test('a concrete engine cannot omit its ownership to pass framework boundaries', () => {
  const workspace = workspaceManifests();
  const engine = workspace.get('@pkgs/chess-rules-shared-ts')!;
  const { game: _game, ...unowned } = engine;
  expect(engine.game).toBe('chess');
  expect(gameViolations(unowned, workspace)).toContain(
    '@pkgs/chess-rules-shared-ts is named for the game chess; declare "game": "chess"'
  );
  expect(
    gameViolations(
      {
        name: '@libs/framework-shared',
        dependencies: { [engine.name]: 'workspace:*' },
      },
      workspace
    )
  ).toHaveLength(1);
});

test('a framework API cannot evade independence by declaring itself a registry', () => {
  expect(
    gameApiViolations(
      {
        name: '@libs/framework-shared',
        gameApi: ['contract'],
        gameRegistry: true,
      },
      {
        workspace: new Map(),
        modules: new Set(['contract']),
        sources: [],
      }
    )
  ).toEqual([
    '@libs/framework-shared offers a game API and composes concrete games: framework contracts must receive games through ports, never a registry',
  ]);
});
