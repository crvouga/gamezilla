import { test } from '@playwright/test';
import { measureHeartsTrials } from './trials';

// The separate recorded journeys retain videos/traces. This measurement
// deliberately excludes that instrumentation and screenshots during input.
test.use({ trace: 'off', video: 'off' });

for (const width of [320, 768, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test.describe(`Hearts isolated latency ${width} ${theme}`, () => {
      test.use({
        viewport: { width, height: width === 320 ? 568 : 900 },
        hasTouch: width < 1024,
      });
      test('storybook integration: Hearts repeated input timing without recording overhead', async ({
        page,
      }, info) => {
        await measureHeartsTrials(page, info, width, theme);
      });
    });
  }
}
