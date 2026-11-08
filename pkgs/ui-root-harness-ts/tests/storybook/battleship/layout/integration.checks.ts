import { expect, test } from '@playwright/test';
import { captureBattleEvidence, openBattleStory } from '../evidence';

test.use({ viewport: { width: 390, height: 844 }, video: 'on', trace: 'on' });

// regression: battleship-target-instructions-crowd-cells
test('storybook integration: battleship targeting instructions label their surface', async ({
  page,
}, info) => {
  await openBattleStory(
    page,
    'screens-games-battleship-board--opening',
    'light'
  );
  try {
    // The region instruction heads the map; the cell instruction is the
    // Fire control directly under the cells it asks for.
    const heading = page.getByText('Choose a region', { exact: true });
    const map = page.getByTestId('custom-game-board-target-grid');
    const aim = page.getByTestId('custom-game-board-aim-grid');
    const fire = page.getByTestId('custom-game-board-fire');
    await expect(fire).toHaveText('Choose a cell in A1–E2');
    const headingBounds = await heading.boundingBox();
    const mapBounds = await map.boundingBox();
    const aimBounds = await aim.boundingBox();
    const fireBounds = await fire.boundingBox();
    if (!headingBounds || !mapBounds || !aimBounds || !fireBounds)
      throw new Error('Target workbench is not visible');
    expect(headingBounds.y + headingBounds.height).toBeLessThanOrEqual(
      mapBounds.y
    );
    expect(aimBounds.y + aimBounds.height).toBeLessThanOrEqual(fireBounds.y);
    expect(fireBounds.y - (aimBounds.y + aimBounds.height)).toBeLessThan(16);
    expect(aimBounds.x).toBeGreaterThanOrEqual(0);
    expect(aimBounds.x + aimBounds.width).toBeLessThanOrEqual(390);
  } finally {
    await captureBattleEvidence(page, info);
  }
});

// regression: battleship-phone-shot-history-overflow
test('storybook integration: battleship shot history keeps the own seat on a phone', async ({
  page,
}, info) => {
  // Earlier shots add the move record above the board. The story's play
  // checks Fire and the own seat fit before input (a failure fails the open);
  // after the shot the key and own seat must still fit without scrolling.
  await openBattleStory(
    page,
    'screens-games-battleship-board--fire-a-shot',
    'light',
    info
  );
  try {
    await expect(page.getByTestId('custom-game-record')).toBeVisible();
    for (const id of [
      'custom-game-board-target-key',
      'custom-game-seat-near',
    ]) {
      const bounds = await page.getByTestId(id).boundingBox();
      if (!bounds) throw new Error(`${id} is not visible`);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
    }
    expect(
      await page.evaluate(() => document.scrollingElement?.scrollTop ?? 0)
    ).toBe(0);
  } finally {
    await captureBattleEvidence(page, info);
  }
});
