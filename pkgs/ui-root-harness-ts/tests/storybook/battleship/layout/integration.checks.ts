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
    const tools = page.getByTestId('custom-game-board-target-tools');
    const aim = page.getByTestId('custom-game-board-aim-grid');
    await expect(tools).toHaveText('Choose a cell: A1–E2');
    const toolsBounds = await tools.boundingBox();
    const aimBounds = await aim.boundingBox();
    if (!toolsBounds || !aimBounds)
      throw new Error('Target workbench is not visible');
    expect(toolsBounds.y + toolsBounds.height).toBeLessThanOrEqual(aimBounds.y);
    expect(aimBounds.x).toBeGreaterThanOrEqual(0);
    expect(aimBounds.x + aimBounds.width).toBeLessThanOrEqual(390);
  } finally {
    await captureBattleEvidence(page, info);
  }
});
