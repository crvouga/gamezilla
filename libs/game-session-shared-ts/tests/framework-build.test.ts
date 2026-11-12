import { expect, test } from 'bun:test';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';
import type { BunPlugin } from 'bun';
import { isolatedFrameworkProof } from './isolated-framework';

const ROOT = realpathSync(join(import.meta.dir, '../../..'));

type Package = {
  readonly name: string;
  readonly game?: string;
  readonly gameRegistry?: boolean;
};

/** Reject game-owned source and registries before the builder can load them. */
function withoutProductionGames(): BunPlugin {
  const manifests = new Map<string, Package>();
  return {
    name: 'no-production-games',
    setup(build) {
      build.onLoad({ filter: /.*/ }, (args) => {
        const path = slashPath(relative(ROOT, realpathSync(args.path)));
        const directory = /^(libs|pkgs|apps)\/[^/]+\//.exec(path)?.[0];
        if (directory === undefined) return undefined;
        let manifest = manifests.get(directory);
        if (manifest === undefined) {
          manifest = JSON.parse(
            readFileSync(join(ROOT, directory, 'package.json'), 'utf8')
          ) as Package;
          manifests.set(directory, manifest);
        }
        if (manifest.game !== undefined || manifest.gameRegistry === true)
          throw new Error(
            `Framework build reached forbidden game dependency: ${manifest.name}`
          );
        return undefined;
      });
    },
  };
}

test('the framework builds and executes with zero production games available', async () => {
  const built = await Bun.build({
    entrypoints: [join(import.meta.dir, 'isolated-framework.ts')],
    target: 'bun',
    plugins: [withoutProductionGames()],
  });
  expect(built.success).toBe(true);
  expect(built.logs).toEqual([]);
  expect(built.outputs).toHaveLength(1);
  // regression: framework-bundle-data-url-crashes-coverage
  // Bun's coverage run aborts on a large module imported from a data: URL,
  // so the built bundle is executed from a file of its own instead.
  const cache = join(import.meta.dir, '../.cache');
  mkdirSync(cache, { recursive: true });
  const directory = mkdtempSync(join(cache, 'framework-build-'));
  const bundlePath = join(directory, 'isolated-framework.js');
  writeFileSync(bundlePath, await built.outputs[0]!.text());
  let result: ReturnType<typeof isolatedFrameworkProof>;
  try {
    const consumer = (await import(bundlePath)) as {
      readonly isolatedFrameworkProof: typeof isolatedFrameworkProof;
    };
    result = consumer.isolatedFrameworkProof();
  } finally {
    removeTree(directory, { whenLocked: 'leave' });
  }
  expect(result).toEqual(isolatedFrameworkProof());
  expect(result).toMatchObject({
    emptyGames: 0,
    emptyRooms: 1,
    offered: true,
    matchmaking: false,
    initial: 'race:0',
    roomCount: 2,
    action: { position: 'race:4', winner: 'black', reason: 'finish line' },
  });
});

test('the isolated builder detects a concrete game hidden behind an entrypoint', async () => {
  const built = await Bun.build({
    entrypoints: [join(ROOT, 'libs/games-shared-ts/src/game-plugins.ts')],
    target: 'bun',
    throw: false,
    plugins: [withoutProductionGames()],
  });
  expect(built.success).toBe(false);
  expect(
    built.logs.some((log) =>
      log.message.includes('Framework build reached forbidden game dependency')
    )
  ).toBe(true);
});
