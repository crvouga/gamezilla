import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
  test,
} from '@playwright/test';
import { logEvidence } from '../summary';

test.use({ video: { mode: 'on', size: { width: 1440, height: 900 } } });

async function open(page: Page, story: string) {
  await page.goto(
    `/iframe.html?id=${story}&viewMode=story&globals=motion:system`
  );
  const arena = page.getByTestId('game-session-board-arena');
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
  return arena;
}

async function record(arena: Locator, info: TestInfo, name: string) {
  const rect = await arena.boundingBox();
  expect(rect).toBeTruthy();
  logEvidence('CROP', { test: info.title, name, rect });
  await arena.screenshot({ path: info.outputPath(`${name}.png`) });
}

async function box(arena: Locator) {
  return arena
    .locator('svg')
    .first()
    .evaluate((element) => {
      if (!(element instanceof SVGSVGElement))
        throw new Error('Missing drawing');
      const { x, y, width, height } = element.viewBox.baseVal;
      return { x, y, width, height };
    });
}

async function at(arena: Locator, point: { x: number; y: number }) {
  return arena
    .locator('svg')
    .first()
    .evaluate((el, p) => {
      if (!(el instanceof SVGSVGElement)) throw new Error('Missing drawing');
      const transform = el.getScreenCTM();
      if (!transform) throw new Error('Missing projection');
      const { x, y } = new DOMPoint(p.x, p.y).matrixTransform(
        transform.inverse()
      );
      return { x, y };
    }, point);
}

async function watcher(page: Page, info: TestInfo) {
  const arena = await open(
    page,
    'screens-games-light-cycles-stage-variants--quad-watching'
  );
  const surface = arena.getByRole('application', { name: /Inspect arena/ });
  await expect(surface).toBeVisible();
  await record(arena, info, 'fitted');
  const rect = await surface.boundingBox();
  if (!rect) throw new Error('Missing arena surface');
  return {
    arena,
    surface,
    anchor: { x: rect.x + rect.width * 0.44, y: rect.y + rect.height * 0.58 },
  };
}

test('light-cycles board inspection desktop wheel drag keyboard and fit', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { arena, surface, anchor } = await watcher(page, info);
  const fitted = await box(arena);
  const world = await at(arena, anchor);
  await page.mouse.move(anchor.x, anchor.y);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -180);
  await page.keyboard.up('Control');
  await expect(arena).not.toHaveAttribute('data-zoom', '1');
  const anchored = await at(arena, anchor);
  expect(anchored.x).toBeCloseTo(world.x, 1);
  expect(anchored.y).toBeCloseTo(world.y, 1);
  await record(arena, info, 'magnified');
  const zoomed = await box(arena);
  await page.mouse.down();
  await page.mouse.move(anchor.x - 48, anchor.y - 24, { steps: 8 });
  await page.mouse.up();
  expect((await box(arena)).x).toBeGreaterThan(zoomed.x);
  await surface.press('ArrowRight');
  await record(arena, info, 'panned');
  await surface.press('Home');
  expect(await box(arena)).toEqual(fitted);
  await arena
    .getByRole('combobox', { name: 'Arena camera' })
    .selectOption('free');
  await arena
    .getByRole('combobox', { name: 'Arena camera' })
    .selectOption('arena');
  expect(await box(arena)).toEqual(fitted);
});

test('light-cycles board inspection phone anchored pinch pan and cancel', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { arena, anchor } = await watcher(page, info);
  const fitted = await box(arena);
  const world = await at(arena, anchor);
  const cdp = await page.context().newCDPSession(page);
  const fingers = (spread: number) => [
    { id: 1, x: anchor.x - spread, y: anchor.y },
    { id: 2, x: anchor.x + spread, y: anchor.y },
  ];
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: fingers(24),
  });
  for (const spread of [30, 36, 42, 48])
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: fingers(spread),
    });
  await expect
    .poll(async () => (await box(arena)).width)
    .toBeCloseTo(fitted.width / 2, 1);
  const anchored = await at(arena, anchor);
  expect(anchored.x).toBeCloseTo(world.x, 1);
  expect(anchored.y).toBeCloseTo(world.y, 1);
  await record(arena, info, 'magnified');
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchCancel',
    touchPoints: [],
  });
  const cancelled = await box(arena);
  const finger = { id: 3, ...anchor };
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [finger],
  });
  expect(await box(arena)).toEqual(cancelled);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ ...finger, x: finger.x - 40 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  expect((await box(arena)).x).toBeGreaterThan(cancelled.x);
  await record(arena, info, 'panned');
  await arena
    .getByRole('combobox', { name: 'Arena camera' })
    .selectOption('arena');
  expect(await box(arena)).toEqual(fitted);
});

for (const motion of ['no-preference', 'reduce'] as const) {
  test(`light-cycles board steering confirmation ${motion}`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ reducedMotion: motion });
    await page.setViewportSize({ width: 1440, height: 900 });
    const arena = await open(
      page,
      'screens-games-light-cycles-stage--queued-turn'
    );
    await expect(
      arena.getByRole('application', { name: /Inspect arena/ })
    ).toHaveCount(0);
    await record(arena, info, 'before-drag');
    const rect = await arena.boundingBox();
    if (!rect) throw new Error('Missing riding surface');
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2 - 30,
      { steps: 8 }
    );
    await page.mouse.up();
    const preview = arena.locator('[data-turn-preview="up"]');
    await expect(preview).toBeVisible();
    const animation = await preview.evaluate(
      (el) => getComputedStyle(el).animationName
    );
    expect(animation === 'none').toBe(motion === 'reduce');
    await expect(arena).toHaveAttribute('data-follow', '0');
    await record(arena, info, 'after-drag');
    await arena.press('ArrowRight');
    await expect(preview).toBeVisible();
    await arena.press('ArrowRight');
    await expect(
      arena.getByTestId('game-session-board-arena-rider-0')
    ).toHaveAttribute('data-heading', 'up');
    await expect(arena.locator('[data-turn-preview="right"]')).toBeVisible();
    await record(arena, info, 'committed');
  });
}
