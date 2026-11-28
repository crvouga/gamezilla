import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { verifyStoryScenario } from '../verify-story-scenario';

async function bounds(element: Locator) {
  await expect(element).toBeInViewport();
  const box = await element.boundingBox();
  if (!box) throw new Error(`Missing bounds for ${element.toString()}`);
  return box;
}

/** The same position with both seats, a turn, a move record and real pieces. */
export async function checkChessSeatLayout(page: Page, info: TestInfo) {
  for (const viewport of [
    { width: 1280, height: 713 },
    { width: 390, height: 844 },
  ]) {
    await verifyStoryScenario(page, 'screens-games-chess-board--early-game', {
      ...viewport,
      globals: {},
      suffix: '',
    });
    await page.screenshot({
      path: info.outputPath(
        `chess-playing-area-${viewport.width}x${viewport.height}.png`
      ),
      animations: 'disabled',
    });
    const opponent = await bounds(page.getByTestId('game-session-black'));
    const viewer = await bounds(page.getByTestId('game-session-white'));
    const turn = await bounds(
      page.locator('[data-component="GameStageStatus"]')
    );
    const history = await bounds(page.locator('[data-game-slot="history"]'));
    const board = page.getByRole('application', {
      name: 'Chess board, white facing you',
    });
    const square = await bounds(board.locator('[data-square="e2"]'));
    const edge = await bounds(board);
    const commands = await bounds(page.locator('[data-game-slot="controls"]'));
    await expect(
      page.getByRole('button', { name: 'All moves' })
    ).toBeInViewport();
    expect(edge.y + edge.height).toBeLessThanOrEqual(commands.y + 1);
    expect(commands.y + commands.height).toBeLessThanOrEqual(
      viewport.height + 1
    );
    if (viewport.width === 1280) {
      expect(opponent.x + opponent.width).toBeLessThanOrEqual(viewer.x);
      expect(Math.abs(opponent.y - viewer.y)).toBeLessThanOrEqual(1);
      expect(turn.x + turn.width).toBeLessThanOrEqual(history.x);
      expect(Math.abs(turn.y - history.y)).toBeLessThanOrEqual(1);
      expect(square.width).toBeGreaterThanOrEqual(44);
      expect(square.height).toBeGreaterThanOrEqual(44);
    } else {
      expect(opponent.y + opponent.height).toBeLessThanOrEqual(viewer.y + 1);
      expect(turn.y + turn.height).toBeLessThanOrEqual(history.y + 1);
    }
  }
}
