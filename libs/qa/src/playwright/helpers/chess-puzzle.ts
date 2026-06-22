import { expect, type Page } from '@playwright/test';

import {
  dragChessPuzzleExpectedMove,
  readChessPuzzleExpectedUci,
} from './chess-board';

const PUZZLE_SOLVE_TIMEOUT_MS = 120_000;
const SPACE_NAV_TIMEOUT_MS = 60_000;
const CHESS_GAME_BUTTON = 'game-menu-chess';

/** Host game rows are Pressable (`role="button"`); guest rows are static (`role="text"`). */
function hostChessGameButton(page: Page) {
  return page.locator(`[data-testid="${CHESS_GAME_BUTTON}"][role="button"]`);
}

async function isHostGamesPickerVisible(page: Page): Promise<boolean> {
  return hostChessGameButton(page).isVisible();
}

async function waitForHostGamesPicker(page: Page): Promise<void> {
  await expect(hostChessGameButton(page)).toBeVisible({
    timeout: SPACE_NAV_TIMEOUT_MS,
  });
}

/** Navigates back from nested chess screens until the host games picker shows. */
async function resetToHostGamesMenu(page: Page): Promise<void> {
  for (let i = 0; i < 8; i += 1) {
    if (await isHostGamesPickerVisible(page)) return;
    const back = page.getByRole('button', { name: /^Back$/i });
    if (!(await back.isVisible().catch(() => false))) break;
    await back.click();
  }
  await waitForHostGamesPicker(page);
}

async function goToSpacesHome(page: Page): Promise<void> {
  const goHome = page.getByRole('button', { name: /go to spaces/i });
  if (await goHome.isVisible().catch(() => false)) {
    await goHome.click();
  } else {
    await page.goto('/');
  }
  await expect(
    page.getByRole('heading', { level: 1, name: 'Spaces' }).first()
  ).toBeVisible({ timeout: SPACE_NAV_TIMEOUT_MS });
}

async function joinSpaceIfPrompted(page: Page): Promise<void> {
  const join = page.getByRole('button', { name: /^Join space$/i });
  if (!(await join.isVisible().catch(() => false))) return;
  if (!(await join.isEnabled().catch(() => false))) return;
  await join.click();
  await expect(page.getByRole('button', { name: /^Joining/i })).toHaveCount(0, {
    timeout: SPACE_NAV_TIMEOUT_MS,
  });
}

async function createNewSpaceWithGames(page: Page): Promise<void> {
  const newSpace = page.getByRole('button', { name: /new space/i });
  await expect(newSpace).toBeVisible({ timeout: SPACE_NAV_TIMEOUT_MS });
  await newSpace.click();
  await page.waitForURL(/\/space\//, { timeout: SPACE_NAV_TIMEOUT_MS });
  await waitForHostGamesPicker(page);
}

async function openHostedSpaceWithGames(page: Page): Promise<void> {
  await expect(
    page.getByRole('button', { name: /^Open space /i }).first()
  ).toBeVisible({
    timeout: SPACE_NAV_TIMEOUT_MS,
  });

  for (let i = 0; i < 8; i += 1) {
    if (i > 0) {
      await goToSpacesHome(page);
    }
    const openButtons = page.getByRole('button', { name: /^Open space /i });
    if ((await openButtons.count()) <= i) break;
    await openButtons.nth(i).click();
    await joinSpaceIfPrompted(page);
    try {
      await resetToHostGamesMenu(page);
      return;
    } catch {
      await goToSpacesHome(page);
    }
  }

  throw new Error(
    'Could not reach the host games menu — create a fresh space or end stale memberships'
  );
}

/**
 * Lands on the space games picker with a host-selectable Chess row.
 * Never returns until `game-menu-chess` is visible — avoids racing patch-db
 * hydration on the spaces list and opening a guest-only space silently.
 */
export async function createSpaceIfNeeded(page: Page): Promise<void> {
  if (await isHostGamesPickerVisible(page)) {
    await resetToHostGamesMenu(page);
    return;
  }

  await goToSpacesHome(page);

  const newSpace = page.getByRole('button', { name: /new space/i });
  if (await newSpace.isVisible().catch(() => false)) {
    await createNewSpaceWithGames(page);
    return;
  }

  await openHostedSpaceWithGames(page);
}

async function ensureChessRootMenu(page: Page): Promise<void> {
  if (await page.getByTestId('chess-menu-puzzle').isVisible().catch(() => false)) {
    return;
  }

  for (let i = 0; i < 8; i += 1) {
    if (await page.getByTestId('chess-menu-puzzle').isVisible()) return;

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

  await page.getByTestId('chess-menu-puzzle').click();

  await expect(async () => {
    const puzzleReady =
      (await board.isVisible().catch(() => false)) ||
      (await expectedUci.isVisible().catch(() => false)) ||
      (await playerElo.isVisible().catch(() => false));
    if (!puzzleReady) {
      if (!(await playScreen.isVisible().catch(() => false))) {
        if (!(await page.getByTestId('chess-menu-puzzle').isVisible().catch(() => false))) {
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
