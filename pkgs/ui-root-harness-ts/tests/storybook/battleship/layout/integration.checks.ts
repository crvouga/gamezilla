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

// In enlarged placement the space kept for a longer refusal sat between the
// "Place in" heading and its guidance: a 40-60px dead band on a phone.
// regression: battleship-placement-heading-band
test('storybook integration: battleship placement heading sits with its guidance on a phone', async ({
  page,
}, info) => {
  await openBattleStory(
    page,
    'screens-games-battleship-setup--enlarged-placement',
    'light',
    info
  );
  const heading = await page
    .getByTestId('custom-game-setup-region-heading')
    .boundingBox();
  const guidance = await page
    .getByTestId('custom-game-setup-guidance')
    .boundingBox();
  const grid = await page
    .getByTestId('custom-game-setup-precision')
    .boundingBox();
  if (!heading || !guidance || !grid) throw new Error('Placement not shown');
  expect(guidance.y - (heading.y + heading.height)).toBeLessThanOrEqual(8);
  expect(grid.y - (guidance.y + guidance.height)).toBeLessThanOrEqual(8);
});

// After the rival sank a ship, the phone strip carried two-line caption and
// move list ("…sank the Destroyer at B9. Your turn to fire." and "B9 sinks
// the Destroyer"), pushing the own seat to 878px on a 390x844 screen.
// regression: battleship-sink-line-pushes-seat
test('storybook integration: battleship own seat stays on a phone after the rival sinks a ship', async ({
  page,
}, info) => {
  await openBattleStory(
    page,
    'screens-games-battleship-board--sunk-by-rival',
    'light',
    info
  );
  for (const id of ['custom-game-board-fire', 'custom-game-seat-near']) {
    const box = await page.getByTestId(id).boundingBox();
    if (!box) throw new Error(`${id} is not shown`);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
  }
});
