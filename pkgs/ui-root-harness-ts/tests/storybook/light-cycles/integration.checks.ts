import { expect, type Page, type TestInfo, test } from '@playwright/test';
import axe from 'axe-core';
import { verifySharedSwipeCapture } from '../light-cycles-pointer';
import { measureSteering } from './measure';
import { measureMotion } from './motion';
import { profileMotion } from './profile';
import { sharedNativeTouch } from './touch';

test.use({
  video: { mode: 'on', size: { width: 1440, height: 1024 } },
  trace: 'on',
});

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
    body: JSON.stringify(results, null, 2),
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
        const cpuRate = screen.width === 390 ? 4 : 1;
        await openArena(page, variant, theme);
        await capture(page, info, 'before-input');
        const arena = await page
          .getByTestId('custom-game-board-arena')
          .boundingBox();
        if (!arena) throw new Error('Arena missing from viewport audit');
        expect(arena.x).toBeGreaterThanOrEqual(0);
        expect(arena.x + arena.width).toBeLessThanOrEqual(screen.width);
        expect(arena.y + arena.height).toBeLessThanOrEqual(screen.height);
        const measurements = await measureSteering(page, cpuRate);
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
                'Two fresh six-input trials. Storybook loading and axe run at normal CPU; only the input window uses the recorded CPU rate. Deterministic production-step fixture. Event dispatch to second animation frame is a paint-opportunity bound, not physical display latency. No live network or continuous simulation claim. CPU throttling is not a physical low-end phone.',
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

test('storybook integration: light-cycles evidence native Tab focus and first steering key', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openArena(page, 'duel-steering', 'light');
  const arena = page.getByTestId('custom-game-board-arena');
  await expect(arena).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(arena).not.toBeFocused();
  await page.keyboard.press('Tab');
  await expect(arena).toBeFocused();
  expect(
    await arena.evaluate((element) => element.matches(':focus-visible'))
  ).toBe(true);
  await capture(page, info, 'keyboard-focus');
  const rider = page.getByTestId('custom-game-board-arena-rider-0');
  const x = Number(await rider.getAttribute('data-x'));
  await page.keyboard.press('ArrowRight');
  await expect(rider).toHaveAttribute('data-x', String(x + 1));
  await capture(page, info, 'first-key');
  await accessibility(page, info);
});

// regression: light-cycles-probe-crossed-quad-round-end
// regression: light-cycles-probe-throttled-harness-startup
// regression: light-cycles-frame-sampler-mixed-time-origins
test('storybook integration: light-cycles evidence Quad measures twelve active inputs across fresh trials', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openArena(page, 'quad-steering', 'light');
  const measurements = await measureSteering(page, 4);
  expect(measurements.inputToPaintMs).toHaveLength(12);
  expect(measurements.frameMs.length).toBeGreaterThan(0);
  expect(measurements.frameMs.every((interval) => interval >= 0)).toBe(true);
});

for (const variant of ['duel', 'trio', 'quad']) {
  for (const cpuRate of [1, 4]) {
    test(`storybook integration: light-cycles evidence sustained ${variant} cpu${cpuRate}`, async ({
      page,
    }, info) => {
      const cdp = await page.context().newCDPSession(page);
      await page.goto(
        `/iframe.html?id=screens-games-light-cycles-motion--${variant}&viewMode=story&globals=theme:dark`
      );
      await expect(page.locator('#storybook-root')).toHaveAttribute(
        'data-story-ready',
        'true'
      );
      await capture(page, info, 'motion-start');
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
      await measureMotion(page, info, cpuRate);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await capture(page, info, 'motion-end');
      await accessibility(page, info);
    });
  }
}

for (const variant of ['trio', 'quad']) {
  test(`storybook integration: light-cycles evidence main-thread profile ${variant} cpu4`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const cdp = await page.context().newCDPSession(page);
    await page.goto(
      `/iframe.html?id=screens-games-light-cycles-motion--${variant}&viewMode=story&globals=theme:dark`
    );
    await expect(page.locator('#storybook-root')).toHaveAttribute(
      'data-story-ready',
      'true'
    );
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await profileMotion(page, cdp, info, 60);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  });
}
