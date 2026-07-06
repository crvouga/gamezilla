import { expect, type Page } from '@playwright/test';

import {
  confirmEndSpace,
  dismissSpaceLifecycleModalSuccess,
  expectEndSpaceConfirmIdle,
} from '../../src/mutation-phases';

import {
  dragChessPuzzleExpectedMove,
  readChessPuzzleExpectedUci,
} from './chess-board';

const PUZZLE_SOLVE_TIMEOUT_MS = 120_000;
const SPACE_NAV_TIMEOUT_MS = 60_000;
const JOIN_PROMPT_COPY = 'Join to see who is here';

/** Host game rows are Pressable (`role="button"`); guest rows are static (`role="text"`). */
function hostChessGameButton(page: Page) {
  return page.getByRole('button', { name: /^Chess$/i });
}

// #region agent log
async function logChessE2eState(
  page: Page,
  location: string,
  hypothesisId: string,
  extra: Record<string, unknown> = {}
): Promise<void> {
  const joinPrompt = await isSpaceJoinPromptVisible(page);
  const hostGames = await isHostGamesPickerVisible(page);
  const chessMenu = await page
    .getByTestId('chess-menu-puzzle')
    .isVisible()
    .catch(() => false);
  const playScreen = await page
    .getByTestId('chess-puzzle-play-screen')
    .isVisible()
    .catch(() => false);
  const pickStatus =
    (await page
      .getByTestId('chess-puzzle-pick-status')
      .textContent()
      .catch(() => null)) ?? null;
  fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': 'b580fa',
    },
    body: JSON.stringify({
      sessionId: 'b580fa',
      location,
      message: 'chess e2e state',
      hypothesisId,
      data: {
        url: page.url(),
        joinPrompt,
        hostGames,
        chessMenu,
        playScreen,
        pickStatus,
        ...extra,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion

async function isHostGamesPickerVisible(page: Page): Promise<boolean> {
  return hostChessGameButton(page).isVisible();
}

async function isSpaceJoinPromptVisible(page: Page): Promise<boolean> {
  return page
    .getByText(JOIN_PROMPT_COPY)
    .isVisible()
    .catch(() => false);
}

async function goToSpacesHome(page: Page): Promise<void> {
  const goToSpaces = page.getByRole('button', { name: /go to spaces/i });
  if (await goToSpaces.isVisible().catch(() => false)) {
    await goToSpaces.click();
  } else {
    const spacesCrumb = page.getByRole('button', { name: /^Spaces$/i });
    if (await spacesCrumb.isVisible().catch(() => false)) {
      await spacesCrumb.click();
    } else {
      const goHome = page.getByRole('button', { name: /go to spaces/i });
      if (await goHome.isVisible().catch(() => false)) {
        await goHome.click();
      } else {
        await page.goto('/');
      }
    }
  }
  await expect(
    page.getByRole('heading', { level: 1, name: 'Spaces' }).first()
  ).toBeVisible({ timeout: SPACE_NAV_TIMEOUT_MS });
}

async function endActiveSpaceFromLobby(page: Page): Promise<void> {
  const returnToSpace = page.getByRole('button', {
    name: /return to your space/i,
  });
  if (!(await returnToSpace.isVisible().catch(() => false))) return;
  await returnToSpace.click();
  const endBtn = page.getByRole('button', { name: /^End space$/i });
  if (!(await endBtn.isVisible({ timeout: 10_000 }).catch(() => false))) {
    await goToSpacesHome(page);
    return;
  }
  await endBtn.click();
  await expectEndSpaceConfirmIdle(page);
  await confirmEndSpace(page);
  await dismissSpaceLifecycleModalSuccess(page, 'Space ended');
  await goToSpacesHome(page);
}

async function reestablishHostSpace(page: Page): Promise<void> {
  // #region agent log
  await logChessE2eState(page, 'chess-puzzle.ts:reestablishHostSpace', 'H2');
  // #endregion
  await goToSpacesHome(page);
  await ensureNoActiveSpaceBlockingCreate(page);
  const newSpace = page.getByRole('button', { name: /new space/i });
  await expect(newSpace).toBeVisible({ timeout: SPACE_NAV_TIMEOUT_MS });
  await newSpace.click();
  await page.waitForURL(/\/space\//, { timeout: SPACE_NAV_TIMEOUT_MS });
  await expect(hostChessGameButton(page)).toBeVisible({
    timeout: SPACE_NAV_TIMEOUT_MS,
  });
}

async function ensureNoActiveSpaceBlockingCreate(page: Page): Promise<void> {
  const newSpace = page.getByRole('button', { name: /new space/i });
  if (await newSpace.isVisible().catch(() => false)) return;

  const returnToSpace = page.getByRole('button', {
    name: /return to your space/i,
  });
  if (await returnToSpace.isVisible().catch(() => false)) {
    await endActiveSpaceFromLobby(page);
  }
}

/**
 * Lands on the space games picker with a host-selectable Chess row.
 * Always creates a fresh hosted space — never opens shared dev-db spaces as a guest.
 */
export async function createSpaceIfNeeded(page: Page): Promise<void> {
  if (await isHostGamesPickerVisible(page)) return;

  await goToSpacesHome(page);
  await ensureNoActiveSpaceBlockingCreate(page);

  const newSpace = page.getByRole('button', { name: /new space/i });
  await expect(newSpace).toBeVisible({ timeout: SPACE_NAV_TIMEOUT_MS });
  await expect(newSpace).toBeEnabled({ timeout: SPACE_NAV_TIMEOUT_MS });
  await newSpace.click({ timeout: 15_000 });
  await page.waitForURL(/\/space\//, { timeout: SPACE_NAV_TIMEOUT_MS });
  // #region agent log
  await logChessE2eState(page, 'chess-puzzle.ts:createSpaceIfNeeded', 'H1');
  // #endregion
  await expect(hostChessGameButton(page)).toBeVisible({
    timeout: SPACE_NAV_TIMEOUT_MS,
  });
}

async function ensureChessRootMenu(page: Page): Promise<void> {
  if (
    await page
      .getByTestId('chess-menu-puzzle')
      .isVisible()
      .catch(() => false)
  ) {
    return;
  }

  if (await isSpaceJoinPromptVisible(page)) {
    await reestablishHostSpace(page);
  }

  for (let i = 0; i < 8; i += 1) {
    if (await page.getByTestId('chess-menu-puzzle').isVisible()) return;

    if (await isSpaceJoinPromptVisible(page)) {
      await reestablishHostSpace(page);
    }

    if (await isHostGamesPickerVisible(page)) {
      await hostChessGameButton(page).click();
      await expect(page.getByTestId('chess-menu-puzzle')).toBeVisible({
        timeout: SPACE_NAV_TIMEOUT_MS,
      });
      return;
    }

    const back = page.getByRole('button', { name: /^Back$/i });
    if (!(await back.isVisible().catch(() => false))) break;
    await back.click();
  }

  await expect(page.getByTestId('chess-menu-puzzle')).toBeVisible({
    timeout: SPACE_NAV_TIMEOUT_MS,
  });
}

export async function openChessFromGames(page: Page): Promise<void> {
  await ensureChessRootMenu(page);
}

export async function openChessPuzzle(page: Page): Promise<void> {
  const board = page.getByTestId('chess-puzzle-board');
  const expectedUci = page.getByTestId('chess-puzzle-expected-uci');
  const playScreen = page.getByTestId('chess-puzzle-play-screen');
  const playerElo = page.getByTestId('chess-puzzle-player-elo');

  await expect(page.getByTestId('chess-menu-puzzle')).toBeVisible({
    timeout: SPACE_NAV_TIMEOUT_MS,
  });
  await page.getByTestId('chess-menu-puzzle').click();

  await expect(async () => {
    if (await isSpaceJoinPromptVisible(page)) {
      // #region agent log
      await logChessE2eState(
        page,
        'chess-puzzle.ts:openChessPuzzle:join-prompt',
        'H3'
      );
      // #endregion
      await reestablishHostSpace(page);
      await openChessFromGames(page);
      await page.getByTestId('chess-menu-puzzle').click();
    }

    const puzzleReady =
      (await board.isVisible().catch(() => false)) ||
      (await expectedUci.isVisible().catch(() => false)) ||
      (await playerElo.isVisible().catch(() => false));
    if (!puzzleReady) {
      if (!(await playScreen.isVisible().catch(() => false))) {
        if (
          !(await page
            .getByTestId('chess-menu-puzzle')
            .isVisible()
            .catch(() => false))
        ) {
          await openChessFromGames(page);
        }
        await page.getByTestId('chess-menu-puzzle').click();
      }
    }
    await expect(playScreen).toBeVisible();
    await expect(board).toBeVisible();
  }).toPass({ timeout: PUZZLE_SOLVE_TIMEOUT_MS });
}

export async function openChessStats(page: Page): Promise<void> {
  await page.getByTestId('chess-menu-stats').click();
  await expect(page.getByTestId('chess-stats-elo')).toBeVisible({
    timeout: SPACE_NAV_TIMEOUT_MS,
  });
}

export async function solveCurrentPuzzle(page: Page): Promise<void> {
  const deadline = Date.now() + PUZZLE_SOLVE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await page.getByTestId('chess-puzzle-summary').isVisible()) return;
    let uci = await readChessPuzzleExpectedUci(page);
    if (uci === null) {
      const hint = page.getByRole('button', { name: /^hint$/i });
      if (
        (await hint.isVisible().catch(() => false)) &&
        (await hint.isEnabled().catch(() => false))
      ) {
        await hint.click();
        await page.waitForTimeout(400);
        uci = await readChessPuzzleExpectedUci(page);
      }
      if (uci === null) {
        await page.waitForTimeout(250);
        continue;
      }
    }
    await dragChessPuzzleExpectedMove(page);
    await page.waitForTimeout(400);
  }
  throw new Error('Timed out solving chess puzzle');
}

export async function continueFromSummary(page: Page): Promise<void> {
  const next = page.getByRole('button', { name: /^next$/i });
  await expect(next).toBeVisible({ timeout: 30_000 });
  await next.click();
}
