import { wallIo } from '@pkgs/io';
import { by, type Driver, expectVisible, waitUntil } from '@pkgs/ui-testing';

import { sleep } from '../sleep';
import type { TestApp } from '../test-app';
import {
  dragChessPuzzleExpectedMove,
  readChessPuzzleExpectedUci,
} from './chess-board';
import {
  hostChessSelector,
  isHostGamesPickerVisible,
  isSpaceJoinPromptVisible,
  reestablishHostSpace,
} from './chess-space';

const io = wallIo();

const PUZZLE_SOLVE_TIMEOUT_MS = 120_000;
const SPACE_NAV_TIMEOUT_MS = 60_000;

async function ensureChessRootMenu(app: TestApp): Promise<void> {
  const { driver } = app;
  if (await driver.isVisible(by.testId('chess-menu-puzzle'))) return;

  if (await isSpaceJoinPromptVisible(driver)) {
    await reestablishHostSpace(app);
  }

  for (let i = 0; i < 8; i += 1) {
    if (await driver.isVisible(by.testId('chess-menu-puzzle'))) return;

    if (await isSpaceJoinPromptVisible(driver)) {
      await reestablishHostSpace(app);
    }

    if (await isHostGamesPickerVisible(driver)) {
      await driver.tap(hostChessSelector());
      await expectVisible(driver, by.testId('chess-menu-puzzle'), {
        timeoutMs: SPACE_NAV_TIMEOUT_MS,
      });
      return;
    }

    if (!(await driver.isVisible(by.role('button', 'Back')))) break;
    await driver.tap(by.role('button', 'Back'));
  }

  await expectVisible(driver, by.testId('chess-menu-puzzle'), {
    timeoutMs: SPACE_NAV_TIMEOUT_MS,
  });
}

export async function openChessFromGames(app: TestApp): Promise<void> {
  await ensureChessRootMenu(app);
}

export async function openChessPuzzle(app: TestApp): Promise<void> {
  const { driver } = app;
  await expectVisible(driver, by.testId('chess-menu-puzzle'), {
    timeoutMs: SPACE_NAV_TIMEOUT_MS,
  });
  await driver.tap(by.testId('chess-menu-puzzle'));

  await waitUntil(
    async () => {
      if (await isSpaceJoinPromptVisible(driver)) {
        await reestablishHostSpace(app);
        await openChessFromGames(app);
        await driver.tap(by.testId('chess-menu-puzzle'));
      }
      const ready =
        (await driver.isVisible(by.testId('chess-puzzle-board'))) ||
        (await driver.isVisible(by.testId('chess-puzzle-expected-uci'))) ||
        (await driver.isVisible(by.testId('chess-puzzle-board-elo')));
      if (!ready) {
        if (!(await driver.isVisible(by.testId('chess-puzzle-play-screen')))) {
          if (!(await driver.isVisible(by.testId('chess-menu-puzzle')))) {
            await openChessFromGames(app);
          }
          await driver.tap(by.testId('chess-menu-puzzle'));
        }
      }
      return (
        (await driver.isVisible(by.testId('chess-puzzle-play-screen'))) &&
        (await driver.isVisible(by.testId('chess-puzzle-board')))
      );
    },
    {
      timeoutMs: PUZZLE_SOLVE_TIMEOUT_MS,
      description: 'chess puzzle board ready',
      now: io.clock.now,
      timers: io.timers,
    }
  );
}

export async function openChessStats(driver: Driver): Promise<void> {
  await driver.tap(by.testId('chess-menu-stats'));
  await expectVisible(driver, by.testId('chess-stats-elo'), {
    timeoutMs: SPACE_NAV_TIMEOUT_MS,
  });
}

export async function solveCurrentPuzzle(driver: Driver): Promise<void> {
  const deadline = io.clock.now() + PUZZLE_SOLVE_TIMEOUT_MS;
  while (io.clock.now() < deadline) {
    if (await driver.isVisible(by.testId('chess-puzzle-summary'))) return;
    let uci = await readChessPuzzleExpectedUci(driver);
    if (uci === null) {
      if (await driver.isVisible(by.role('button', 'Hint'))) {
        await driver.tap(by.role('button', 'Hint'));
        await sleep(400);
        uci = await readChessPuzzleExpectedUci(driver);
      }
      if (uci === null) {
        await sleep(250);
        continue;
      }
    }
    await dragChessPuzzleExpectedMove(driver);
    await sleep(400);
  }
  throw new Error('Timed out solving chess puzzle');
}

export async function continueFromSummary(driver: Driver): Promise<void> {
  await expectVisible(driver, by.role('button', 'Next'), {
    timeoutMs: 30_000,
  });
  await driver.tap(by.role('button', 'Next'));
}
