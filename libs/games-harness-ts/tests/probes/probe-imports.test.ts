/**
 * The probe games are independent consumers: written as a game is, they
 * import from a framework package only the modules it declares public
 * (`"gameApi"`), the rule `gameApiViolations` enforces on a game package's
 * lint. Only the framework's side of a probe (`probe-verdict.ts`) and the
 * tests judging them reach further.
 */

import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROBES = import.meta.dir;
const REPO = join(PROBES, '../../../..');

/** The framework's side, which judges the probe games. */
const JUDGES = /(\.test\.tsx?|^probe-verdict\.ts)$/;

/** `@libs/<pkg>` or `@pkgs/<pkg>`'s public game API, if it declares one. */
function gameApiOf(dependency: string): readonly string[] | undefined {
  const [tier = '', name = ''] = dependency.slice(1).split('/');
  const manifest = readFileSync(join(REPO, tier, name, 'package.json'), 'utf8');
  return (JSON.parse(manifest) as { readonly gameApi?: readonly string[] })
    .gameApi;
}

/** Each import of a framework module outside its package's game API. */
function gameApiViolations(file: string, text: string): readonly string[] {
  const specifiers = [
    ...text.matchAll(/(?:from|import)\s*\(?\s*'([^']+)'/g),
  ].map((match) => match[1] ?? '');
  return specifiers.flatMap((specifier) => {
    const match = /^(@(?:libs|pkgs)\/[^/]+)\/(.+)$/.exec(specifier);
    if (match === null) return [];
    const api = gameApiOf(match[1] ?? '');
    return api === undefined || api.includes(match[2] ?? '')
      ? []
      : [`${file}: ${specifier} is not in ${match[1]}'s gameApi`];
  });
}

function probeGames(): readonly string[] {
  return [...new Bun.Glob('*.{ts,tsx}').scanSync(PROBES)]
    .filter((file) => !JUDGES.test(file))
    .sort();
}

test('every probe game imports only the framework public game API', async () => {
  const games = probeGames();
  expect(games).toEqual([
    'count-rules.ts',
    'double-turn-game.ts',
    'misere-tally-game.ts',
    'probe-parts.tsx',
    'puzzle-only-game.ts',
    'setup-race-game.ts',
    'solo-count-game.tsx',
  ]);
  const violations: string[] = [];
  for (const file of games) {
    const text = await Bun.file(join(PROBES, file)).text();
    violations.push(...gameApiViolations(file, text));
    if (/from '\.\/probe-verdict'|from '\.\.\/conformance/.test(text))
      violations.push(`${file}: imports the framework's verdict`);
  }
  expect(violations).toEqual([]);
});

test('the check refuses a framework module outside its game API', () => {
  expect(
    gameApiViolations(
      'stray.ts',
      "import { CustomGamesAttr } from '@libs/game-session-shared-ts/custom-game-state';"
    )
  ).toEqual([
    "stray.ts: @libs/game-session-shared-ts/custom-game-state is not in @libs/game-session-shared-ts's gameApi",
  ]);
  expect(
    gameApiViolations(
      'fine.ts',
      "import { defineGame } from '@libs/game-session-shared-ts/game-definition';"
    )
  ).toEqual([]);
});
