// @io-wall-ok — canonical browser evidence for the Word Tiles board.
import { test } from '@playwright/test';
import {
  auditAccessibility,
  observeInput,
  openStory,
  recordEvidence,
} from './evidence';
import { playWord } from './native-input';

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
    for (const players of ['two', 'three', 'four']) {
      test(`storybook integration: word-tiles native ${input} ${players} players`, async ({
        page,
      }, info) => {
        const session = await page.context().newCDPSession(page);
        await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        await info.attach('conditions.json', {
          body: JSON.stringify({
            cpuRate: 4,
            input,
            players,
            viewport: page.viewportSize(),
            theme: 'light',
          }),
          contentType: 'application/json',
        });
        await openStory(page, `${players}-player-match`, 'light');
        await playWord(page, input);
        await auditAccessibility(page, info);
      });
    }
  });
}
