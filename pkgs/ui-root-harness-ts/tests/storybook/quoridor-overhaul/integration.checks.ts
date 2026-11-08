// @io-wall-ok — Playwright owns browser, recordings and cleanup.
import { expect, test } from '@playwright/test';
import { observeQuoridorInput, recordQuoridorState } from './evidence';
import { exerciseQuoridorNativeInput } from './native-input';

test.use({ video: 'on', trace: 'on', hasTouch: true });

const journeys = {
  classic: [
    'opening',
    'keyboard-wall-cancellation',
    'place-a-wall',
    'keep-a-path-open',
    'pawn-identity-and-keyboard',
    'precise-coordinates',
    'rotate-wall-preview',
    'reach-opposite-edge',
    'watching',
  ],
  hill: [
    'opening',
    'keyboard-wall-cancellation',
    'four-player-round',
    'recover-wall-placement',
    'precise-coordinates',
    'pass-and-continue',
    'reach-the-hill',
    'waiting-for-others',
    'lost',
  ],
} as const;

for (const variant of ['classic', 'hill'] as const)
  for (const width of [390, 768, 1440])
    for (const theme of ['light', 'dark'])
      test(`storybook integration: quoridor overhaul ${variant} ${width} ${theme}`, async ({
        page,
      }, info) => {
        test.setTimeout(180_000);
        await page.setViewportSize({
          width,
          height: width === 390 ? 844 : 1024,
        });
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', {
          rate: width === 390 ? 4 : 1,
        });
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.route('**/*', (route) =>
          new URL(route.request().url()).hostname === '127.0.0.1'
            ? route.continue()
            : route.abort()
        );
        await observeQuoridorInput(page);
        for (const journey of journeys[variant])
          await test.step(`${variant}: ${journey}`, async () => {
            await recordQuoridorState(
              page,
              info,
              `screens-games-quoridor-${variant}--${journey}`,
              theme
            );
            if (journey === 'opening')
              await exerciseQuoridorNativeInput(page, info);
          });
        expect(errors).toEqual([]);
      });
