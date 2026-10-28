import { expect, test } from 'bun:test';
import { posix, win32 } from 'node:path';
import { pathPattern } from './independence/path-pattern';

const REGISTRY = new RegExp(
  `${pathPattern('libs/games-shared-ts/src/game-plugins.ts')}$`
);
const GAME = new RegExp(pathPattern('/libs/chess-shared-ts/'));

// regression: isolation-filter-windows-separator
test.each([
  ['Windows', win32.join('C:\\repo', 'libs')],
  ['POSIX', posix.join('/repo', 'libs')],
])('the isolation filters match a %s source path', (_, libs) => {
  const os = libs.includes('\\') ? win32 : posix;
  expect(
    REGISTRY.test(os.join(libs, 'games-shared-ts', 'src', 'game-plugins.ts'))
  ).toBe(true);
  expect(GAME.test(os.join(libs, 'chess-shared-ts', 'src', 'a.ts'))).toBe(true);
  expect(GAME.test(os.join(libs, 'chess-shared-tsx', 'a.ts'))).toBe(false);
});
