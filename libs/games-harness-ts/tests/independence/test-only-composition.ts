import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { plugin } from 'bun';

const ROOT = realpathSync(join(import.meta.dir, '../../../..'));
const CONSUMER = join(import.meta.dir, '../probes/setup-race-game.ts');
/** Only composition exports are substituted; consumers use the real public contracts. */
const REGISTRIES: Readonly<Record<string, string>> = {
  'libs/games-harness-ts/src/harness-games.ts':
    'export const HARNESS_GAMES = [SETUP_RACE_GAME];',
  'libs/games-shared-ts/src/game-plugins.ts':
    'export const GAME_DEFINITIONS = [SETUP_RACE_GAME.shared];\nexport const TURN_GAME_DEFINITIONS = GAME_DEFINITIONS;',
  'libs/games-client-ts/src/game-plugins.client.ts':
    'export const GAME_CLIENT_DEFINITIONS = [SETUP_RACE_GAME.client];',
};

function escaped(path: string): string {
  return path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

plugin({
  name: 'test-only-game-composition',
  setup(build) {
    for (const [path, source] of Object.entries(REGISTRIES))
      build.onLoad({ filter: new RegExp(`${escaped(path)}$`) }, () => ({
        contents: `import { SETUP_RACE_GAME } from ${JSON.stringify(CONSUMER)};\n${source}`,
        loader: 'js',
      }));
    for (const path of new Bun.Glob('{libs,pkgs,apps}/*/package.json').scanSync(
      ROOT
    )) {
      const owner = JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as {
        readonly name: string;
        readonly game?: string;
      };
      if (owner.game === undefined) continue;
      const directory = path.slice(0, -'package.json'.length);
      build.onLoad({ filter: new RegExp(`/${escaped(directory)}`) }, () => {
        throw new Error(`ISOLATION_BLOCKED_GAME: ${owner.name}`);
      });
    }
  },
});
