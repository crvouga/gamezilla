#!/usr/bin/env bun
// @io-wall-ok — tools composition root

/**
 * Scaffold a new `@libs/<game>` package with RoomModule.hash, sim tests, and
 * no wall globals. See DETERMINISM.md and AGENTS.md § Adding a new game.
 *
 * Usage: bun run scaffold:game -- <kebab-name>
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../..');
const TEMPLATE_ROOT = join(REPO_ROOT, 'tools/templates/game');

function usage(): never {
  console.error('Usage: bun run scaffold:game -- <kebab-name>');
  console.error('Example: bun run scaffold:game -- connect-four');
  process.exit(1);
}

function toPascal(kebab: string): string {
  return kebab
    .split('-')
    .filter((p) => p.length > 0)
    .map((p) => p[0]!.toUpperCase() + p.slice(1))
    .join('');
}

function render(text: string, game: string, pascal: string): string {
  return text
    .replaceAll('__GAME_PASCAL__', pascal)
    .replaceAll('__GAME__', game);
}

const raw = process.argv.slice(2).filter((a) => a !== '--');
const game = raw[0];
if (game === undefined || game.length === 0) usage();
if (!/^[a-z]+(?:-[a-z]+)*$/.test(game)) {
  console.error(
    `invalid game name ${JSON.stringify(game)} — expected lowercase kebab-case`
  );
  process.exit(1);
}

const pascal = toPascal(game);
const destRoot = join(REPO_ROOT, 'libs', game);
if (existsSync(destRoot)) {
  console.error(`refusing to overwrite existing ${destRoot}`);
  process.exit(1);
}

const files: Array<{ from: string; to: string }> = [
  { from: 'package.json', to: 'package.json' },
  { from: 'tsconfig.tc.json', to: 'tsconfig.tc.json' },
  {
    from: 'src/shared/__GAME__-module.ts',
    to: `src/shared/${game}/${game}-module.ts`,
  },
  {
    from: 'src/shared/__GAME__-module.test.ts',
    to: `src/shared/${game}/${game}-module.test.ts`,
  },
  {
    from: 'src/shared/__GAME__-module.sim.test.ts',
    to: `src/shared/${game}/${game}-module.sim.test.ts`,
  },
  { from: 'src/root/client/.gitkeep', to: 'src/root/client/.gitkeep' },
  { from: 'src/root/server/.gitkeep', to: 'src/root/server/.gitkeep' },
  { from: 'src/public/.gitkeep', to: 'src/public/.gitkeep' },
];

for (const { from, to } of files) {
  const src = join(TEMPLATE_ROOT, from);
  const dest = join(destRoot, to);
  mkdirSync(dirname(dest), { recursive: true });
  const body = render(readFileSync(src, 'utf8'), game, pascal);
  writeFileSync(dest, body);
  console.log(`wrote ${join('libs', game, to)}`);
}

const alias = `"@libs/${game}/*": ["./libs/${game}/src/*"]`;
console.log(`
Next steps (not auto-applied):
  1. Add path alias to root tsconfig.json: ${alias}
  2. bun install
  3. Register a GameDefinition in libs/spaces (games registry) + client menu
  4. bun run --filter @libs/${game} test
  5. bun run lint
`);
