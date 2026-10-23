import { expect, test } from 'bun:test';
import { readFileSync, realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
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
        const path = relative(ROOT, realpathSync(args.path));
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
  const bundle = await built.outputs[0]!.text();
  const consumer = (await import(
    `data:text/javascript;base64,${Buffer.from(bundle).toString('base64')}`
  )) as {
    readonly isolatedFrameworkProof: typeof isolatedFrameworkProof;
  };
  const result = consumer.isolatedFrameworkProof();
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
