import { expect, test } from '@playwright/test';
import { verifyStoryScenario } from '../verify-story-scenario';

const screens = [
  {
    story: 'screens-game-home--classic-quoridor',
    name: 'main-menu',
    controls: ['game-choice-multiplayer', 'game-choice-vs-human'],
  },
  {
    story: 'screens-matchmaking-home--king-of-the-hill',
    name: 'match-making',
    controls: ['multiplayer-find'],
  },
  {
    story: 'screens-game-sessions-home--king-of-the-hill',
    name: 'game-sessions',
    controls: ['game-session-white-choices', 'game-session-blue-choices'],
  },
];

for (const screen of screens) {
  test(`Quoridor game-mode-setup ${screen.name}`, async ({ page }, info) => {
    await verifyStoryScenario(page, screen.story, {
      width: 390,
      height: 844,
      globals: {},
      suffix: '',
    });
    await expect(page.getByTestId('space-title')).toContainText('Quoridor');
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
