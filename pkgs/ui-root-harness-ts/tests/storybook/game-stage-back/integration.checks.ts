// @io-wall-ok — Playwright owns the browser and screenshots.
import { expect, test } from '@playwright/test';

test('storybook integration: stage Back preserves play or returns to the previous space screen', async ({
  page,
}, info) => {
  await page.goto(
    '/iframe.html?id=screens-games-quoridor-stage-back--playing&viewMode=story&globals=theme:light;motion:reduced'
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  const choices = page.getByTestId('game-choices');
  const back = page.getByTestId('nav-back');
  const move = page.getByTestId('custom-game-board-action-e2');
  const capture = (name: string) =>
    page.screenshot({
      path: info.outputPath(name + '.png'),
      animations: 'disabled',
    });
  await expect(choices).toBeVisible();
  await page.getByTestId('game-choice-custom-game').click();
  await expect(move).toBeEnabled();
  await capture('01-playing');
  await back.click();
  await expect(page.getByRole('dialog')).toContainText('Resign and go back?');
  await capture('02-back-asks');
  await page.getByTestId('game-back-stay').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await move.click();
  await expect(move).toHaveAccessibleName(/South red circle/);
  await capture('03-stayed-and-moved');
  await back.click();
  const resign = page.getByTestId('game-back-confirm');
  await expect(resign).toContainText('Resign game');
  await capture('04-confirm-resignation');
  await resign.click();
  await expect(choices).toBeVisible();
  await expect(page.getByTestId('custom-game-content')).toHaveCount(0);
  await capture('05-returned-to-game-choices');
});
