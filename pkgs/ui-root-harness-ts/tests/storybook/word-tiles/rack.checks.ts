import { expect, test } from '@playwright/test';
import { verifyStoryScenario } from '../verify-story-scenario';

// regression: word-tiles-rounded-rack-hit-targets
test('all seven opening letters remain reachable inside the rounded rack', async ({
  page,
}) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ]) {
    await verifyStoryScenario(page, 'screens-games-word-tiles-board--opening', {
      ...viewport,
      suffix: '',
      globals: {},
    });
    const tiles = page
      .getByTestId('game-session-board-rack')
      .getByRole('button');
    await expect(tiles).toHaveCount(7);
    for (const tile of await tiles.all()) await tile.click({ trial: true });
  }
});
