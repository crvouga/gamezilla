import { expect, test } from '@playwright/test';
import { captureBattleEvidence, openBattleStory } from './evidence';
import { measureTargeting } from './responsiveness';

test.use({ video: 'on', trace: 'on', hasTouch: true });

const screens = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];
const stories = [
  'setup--empty',
  'setup--arrange-full-fleet',
  'setup--enlarged-placement',
  'setup--refused-off-board',
  'setup--locked',
  'board--opening',
  'board--correct-target-before-firing',
  'board--fire-a-shot',
  'board--hit-a-ship',
  'board--sink-a-ship',
  'board--sink-the-fleet',
  'board--waiting-for-opponent',
  'board--watching',
  'board--lost',
];

for (const viewport of screens)
  for (const theme of ['light', 'dark'])
    for (const story of stories)
      test(`storybook integration: battleship ${story} ${viewport.width}/${theme}`, async ({
        page,
      }, info) => {
        await page.setViewportSize(viewport);
        const errors = await openBattleStory(
          page,
          `screens-games-battleship-${story}`,
          theme,
          info
        );
        await captureBattleEvidence(page, info);
        if (story === 'board--opening') await measureTargeting(page, info);
        expect(errors).toEqual([]);
        await info.attach('task-evidence-limits', {
          body: JSON.stringify({
            story,
            viewport,
            theme,
            result: 'Storybook production component and native play completed',
            limits:
              'Component fixture evidence. Does not establish live multiplayer transport, persisted setup, or recovery in the running app. Native play may use synthesized touch; hasTouch alone is not physical touch evidence.',
          }),
          contentType: 'application/json',
        });
      });
