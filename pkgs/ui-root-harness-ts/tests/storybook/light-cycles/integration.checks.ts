import { expect, type Page, type TestInfo, test } from '@playwright/test';
import axe from 'axe-core';
import { verifySharedSwipeCapture } from '../light-cycles-pointer';
import { measureSteering } from './measure';
import { measureMotion } from './motion';
import { sharedNativeTouch } from './touch';

test.use({ video: 'on', trace: 'on' });

const screens = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;
const variants = ['duel-steering', 'steer-up', 'quad-steering'] as const;

async function openArena(page: Page, story: string, theme: string) {
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort()
  );
  await page.goto(
    `/iframe.html?id=screens-games-light-cycles-arena--${story}&viewMode=story&globals=theme:${theme}`
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
}

async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await info.attach(name, { path, contentType: 'image/png' });
}

async function accessibility(page: Page, info: TestInfo) {
  await page.addScriptTag({ content: axe.source });
  const results = await page.evaluate(async () => {
    const browser = window as unknown as { axe: typeof axe };
    return browser.axe.run('#storybook-root');
  });
  await info.attach('accessibility.json', {
    body: JSON.stringify(results.violations, null, 2),
    contentType: 'application/json',
  });
  expect(
    results.violations.filter(
      (violation) =>
        violation.impact === 'serious' || violation.impact === 'critical'
    )
  ).toEqual([]);
}

for (const screen of screens) {
  for (const theme of ['light', 'dark']) {
    for (const variant of variants) {
      test(`storybook integration: light-cycles evidence ${variant} ${screen.width} ${theme}`, async ({
        page,
      }, info) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.setViewportSize(screen);
        const cdp = await page.context().newCDPSession(page);
        const cpuRate = screen.width === 390 ? 4 : 1;
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
        await openArena(page, variant, theme);
        await capture(page, info, 'before-input');
        const arena = await page
          .getByTestId('custom-game-board-arena')
          .boundingBox();
        if (!arena) throw new Error('Arena missing from viewport audit');
        expect(arena.x).toBeGreaterThanOrEqual(0);
        expect(arena.x + arena.width).toBeLessThanOrEqual(screen.width);
        expect(arena.y + arena.height).toBeLessThanOrEqual(screen.height);
        const measurements = await measureSteering(page);
        expect(measurements.inputToPaintMs).toHaveLength(12);
        await info.attach('responsiveness.json', {
          body: JSON.stringify(
            {
              variant,
              screen,
              theme,
              cpuRate,
              samples: measurements,
              limits:
                'Deterministic Storybook production-step fixture. Event dispatch to second animation frame is a paint-opportunity bound, not physical display latency. No live network or continuous simulation claim. CPU throttling is not a physical low-end phone.',
            },
            null,
            2
          ),
          contentType: 'application/json',
        });
        await capture(page, info, 'after-input');
        await accessibility(page, info);
        expect(errors).toEqual([]);
      });
    }
  }
}

for (const state of [
  'countdown',
  'crashed',
  'round-over',
  'finished',
  'watching',
  'reconnecting',
  'riding-elsewhere',
  'unreadable',
  'collision-through-next-round',
  'resumed-steering',
  'shared-keyboard',
]) {
  for (const theme of ['light', 'dark']) {
    test(`storybook integration: light-cycles evidence ${state} ${theme}`, async ({
      page,
    }, info) => {
      await openArena(page, state, theme);
      await capture(page, info, state);
      await accessibility(page, info);
    });
  }
}

test('storybook integration: light-cycles evidence shared native pointer', async ({
  page,
}, info) => {
  await verifySharedSwipeCapture(page);
  await capture(page, info, 'shared-pointer');
  await accessibility(page, info);
});

test('storybook integration: light-cycles evidence simultaneous native touch', async ({
  page,
}, info) => {
  await openArena(page, 'shared-swipe', 'light');
  await capture(page, info, 'before-touch');
  await sharedNativeTouch(page);
  await capture(page, info, 'after-touch');
  await accessibility(page, info);
});

// regression: light-cycles-probe-crossed-quad-round-end
test('storybook integration: light-cycles evidence Quad measures twelve active inputs across fresh trials', async ({
  page,
}) => {
  await openArena(page, 'quad-steering', 'light');
  const measurements = await measureSteering(page);
  expect(measurements.inputToPaintMs).toHaveLength(12);
});

for (const variant of ['duel', 'trio', 'quad']) {
  for (const cpuRate of [1, 4]) {
    test(`storybook integration: light-cycles evidence sustained ${variant} cpu${cpuRate}`, async ({
      page,
    }, info) => {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
      await page.goto(
        `/iframe.html?id=screens-games-light-cycles-motion--${variant}&viewMode=story&globals=theme:dark`
      );
      await expect(page.locator('#storybook-root')).toHaveAttribute(
        'data-story-ready',
        'true'
      );
      await capture(page, info, 'motion-start');
      await measureMotion(page, info);
      await capture(page, info, 'motion-end');
      await accessibility(page, info);
    });
  }
}
