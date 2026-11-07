// @io-wall-ok — canonical browser evidence for the Word Tiles board.
import { expect, test } from '@playwright/test';
import {
  auditAccessibility,
  observeInput,
  openStory,
  recordEvidence,
} from './evidence';

test.use({ video: 'on', trace: 'on' });
test.beforeEach(async ({ page }) => observeInput(page));
test.afterEach(async ({ page }, info) => recordEvidence(page, info));

const stories = [
  'opening',
  'your-turn',
  'three-players',
  'four-players',
  'watching',
  'waiting-for-opponent',
  'game-over',
  'checking-words',
  'word-list-unavailable',
  'unreadable',
  'place-a-word',
  'assign-a-blank',
  'recall-and-restore',
  'recover-and-submit',
  'accepted-pass',
  'accepted-exchange',
  'enlarged-coordinates',
];
for (const theme of ['light', 'dark']) {
  test.describe(`word tiles ${theme}`, () => {
    for (const story of stories) {
      test(`storybook integration: word-tiles evidence ${story} ${theme}`, async ({
        page,
      }, info) => {
        await openStory(page, story, theme);
        await auditAccessibility(page, info);
      });
    }
    for (const size of [
      { width: 320, height: 740 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      test(`storybook integration: word-tiles opening ${theme} ${size.width}`, async ({
        page,
      }, info) => {
        await page.setViewportSize(size);
        await openStory(page, 'opening', theme);
        await auditAccessibility(page, info);
      });
    }
  });
}

for (const input of ['mouse', 'touch', 'keyboard'] as const) {
  test.describe(`native ${input}`, () => {
    test.use({ hasTouch: input === 'touch' });
    test(`storybook integration: word-tiles native ${input} placement`, async ({
      page,
    }, info) => {
      const session = await page.context().newCDPSession(page);
      await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await openStory(page, 'opening', 'light');
      for (const [tile, cell] of [
        ['11', 'g8'],
        ['0', 'h8'],
        ['82', 'i8'],
      ] as const) {
        const rack = page.getByTestId(`custom-game-board-rack-${tile}`);
        const target = page.getByTestId(`custom-game-board-cell-${cell}`);
        if (input === 'keyboard') {
          await rack.focus();
          await rack.press('Enter');
          await target.focus();
          await target.press('Enter');
        } else if (input === 'touch') {
          await rack.tap();
          await target.tap();
        } else {
          await rack.click();
          await target.click();
        }
        await expect(target).toHaveAttribute('data-state', 'tentative');
      }
      await expect(page.getByTestId('custom-game-board-submit')).toBeEnabled();
      await expect(page.getByTestId('custom-game-board-status')).toContainText(
        '10'
      );
      await auditAccessibility(page, info);
    });
  });
}
