import { expect, test } from '@playwright/test';
import { verifyStoryScenario } from '../verify-story-scenario';

const screens = [
  {
    story: 'screens-game-home--classic-quoridor',
    name: 'main-menu',
    controls: ['game-choice-multiplayer', 'game-choice-custom-game'],
  },
  {
    story: 'screens-matchmaking-home--king-of-the-hill',
    name: 'match-making',
    controls: ['multiplayer-find'],
  },
  {
    story: 'screens-custom-games-home--king-of-the-hill',
    name: 'custom-games',
    controls: ['custom-game-white-choices', 'custom-game-blue-choices'],
  },
];

for (const screen of screens) {
  test(`Quoridor game-mode-setup ${screen.name}`, async ({ page }, info) => {
    await verifyStoryScenario(page, screen.story, {
      width: 390,
      height: 844,
      theme: 'light',
      globals: {},
      suffix: '',
    });
    for (const handle of screen.controls)
      await expect(page.getByTestId(handle)).toBeVisible();
    const mode = page.getByRole('radio', { name: 'King of the Hill' });
    if (screen.name === 'main-menu') await expect(mode).toHaveCount(0);
    else await expect(mode).toBeChecked();
    await page.screenshot({
      path: info.outputPath(`${screen.name}.png`),
      animations: 'disabled',
    });
  });
}
