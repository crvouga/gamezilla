import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
  test,
} from '@playwright/test';
import { logEvidence } from '../summary';

test.use({ video: { mode: 'on', size: { width: 1440, height: 900 } } });

async function capture(arena: Locator, info: TestInfo, name: string) {
  const rect = await arena.boundingBox();
  logEvidence('FOLLOW', { test: info.title, name, rect });
  await arena.screenshot({ path: info.outputPath(`${name}.png`) });
}

/** Move the real simulation in 100ms increments, allowing display frames between steps. */
async function ride(page: Page, steps: number) {
  await page.locator('#storybook-root').evaluate(async (root, count) => {
    for (let i = 0; i < count; i++) {
      root.dispatchEvent(
        new CustomEvent('advance-story-time', { detail: 100 })
      );
      for (let frame = 0; frame < 5; frame++)
        await new Promise<void>((done) => requestAnimationFrame(() => done()));
    }
  }, steps);
}

async function turn(
  page: Page,
  arena: Locator,
  direction: 'up' | 'right',
  phone: boolean
) {
  if (!phone) return arena.press(direction === 'up' ? 'ArrowUp' : 'ArrowRight');
  const box = await arena.boundingBox();
  if (!box) throw new Error('Missing arena');
  const start = { id: 1, x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [start],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      {
        ...start,
        x: start.x + (direction === 'right' ? 32 : 0),
        y: start.y - (direction === 'up' ? 32 : 0),
      },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await cdp.detach();
}

async function visibleHead(arena: Locator, seat: number) {
  const rect = await arena.boundingBox();
  const head = await arena
    .getByTestId(`game-session-board-arena-rider-${seat}`)
    .boundingBox();
  if (!rect || !head) throw new Error('Missing rider or arena');
  expect(head.x + head.width / 2).toBeGreaterThanOrEqual(rect.x);
  expect(head.x + head.width / 2).toBeLessThanOrEqual(rect.x + rect.width);
  expect(head.y + head.height / 2).toBeGreaterThanOrEqual(rect.y - 1);
  expect(head.y + head.height / 2).toBeLessThanOrEqual(
    rect.y + rect.height + 1
  );
}

async function selectView(arena: Locator, target: string) {
  const head = arena.getByTestId('game-session-board-arena-rider-0');
  const position = await head.getAttribute('transform');
  const heading = await head.getAttribute('data-heading');
  const picker = arena.getByRole('combobox', { name: 'Arena camera' });
  await picker.selectOption(target);
  await expect(arena).toHaveAttribute('data-follow', target);
  await expect(picker).toHaveValue(target);
  await expect(head).toHaveAttribute('transform', position ?? '');
  await expect(head).toHaveAttribute('data-heading', heading ?? '');
}

async function bends(
  page: Page,
  arena: Locator,
  phone: boolean,
  player: boolean
) {
  const rider = arena.getByTestId('game-session-board-arena-rider-0');
  if (player) await turn(page, arena, 'up', phone);
  await ride(page, 2);
  await expect(rider).toHaveAttribute('data-heading', 'up');
  if (player) await turn(page, arena, 'right', phone);
  await ride(page, 5);
  await expect(rider).toHaveAttribute('data-heading', 'right');
  await visibleHead(arena, 0);
  await ride(page, 4);
  if (player) await turn(page, arena, 'up', phone);
  await ride(page, 1);
  await expect(rider).toHaveAttribute('data-heading', 'up');
}

for (const phone of [true, false]) {
  for (const player of [true, false]) {
    test(`light-cycles rider follow ${phone ? 'phone' : 'desktop'} ${player ? 'player' : 'spectator'}`, async ({
      page,
    }, info) => {
      await page.setViewportSize(
        phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }
      );
      const reduced = phone && !player;
      await page.emulateMedia({
        reducedMotion: reduced ? 'reduce' : 'no-preference',
      });
      await page.goto(
        `/iframe.html?id=screens-games-light-cycles-stage--follow-${player ? 'own' : 'watched'}-cycle&viewMode=story&globals=theme:dark;motion:system`
      );
      await expect(page.locator('#storybook-root')).toHaveAttribute(
        'data-story-ready',
        'true'
      );
      const arena = page.getByTestId('game-session-board-arena');
      const rider = arena.getByTestId('game-session-board-arena-rider-0');
      const picker = arena.getByRole('combobox', { name: 'Arena camera' });
      await expect(arena).toHaveAttribute(
        'data-follow',
        player ? '0' : 'arena'
      );
      await expect(picker).toHaveValue(player ? '0' : 'arena');
      await selectView(arena, 'arena');
      await capture(arena, info, 'full-arena');
      await selectView(arena, '0');
      const field = arena.locator('[data-follow-field]');
      const start = await field.getAttribute('style');
      const duration = await field.evaluate(
        (el) => getComputedStyle(el).transitionDuration
      );
      expect(parseFloat(duration) > 0).toBe(!reduced);
      await capture(arena, info, 'following');
      await bends(page, arena, phone, player);
      expect(await field.getAttribute('style')).not.toBe(start);
      await capture(arena, info, 'corner');
      await selectView(arena, '1');
      await visibleHead(arena, 1);
      await capture(arena, info, 'switched');
      await selectView(arena, '0');
      await ride(page, 8);
      await expect(rider).toHaveAttribute('data-alive', 'false');
      await expect(picker.locator('option:checked')).toContainText(
        'Comet (out)'
      );
      await visibleHead(arena, 0);
      await capture(arena, info, 'crash');
      const stopped = await field.getAttribute('style');
      await ride(page, 2);
      expect(await field.getAttribute('style')).toBe(stopped);
      await ride(page, 20);
      await expect(arena).toHaveAttribute('data-round', '2');
      await expect(arena).toHaveAttribute('data-follow', '0');
      await expect(rider).toHaveAttribute('data-alive', 'true');
      await visibleHead(arena, 0);
      await capture(arena, info, 'next-round');
      await selectView(arena, 'arena');
      await capture(arena, info, 'returned');
    });
  }
}

for (const phone of [true, false]) {
  test(`light-cycles rider follow fitted reference ${phone ? 'phone' : 'desktop'}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(
      phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }
    );
    await page.goto(
      `/iframe.html?id=screens-games-light-cycles-stage--follow-${phone ? 'own' : 'watched'}-cycle&viewMode=story&globals=theme:dark;motion:system`
    );
    await expect(page.locator('#storybook-root')).toHaveAttribute(
      'data-story-ready',
      'true'
    );
    const arena = page.getByTestId('game-session-board-arena');
    await selectView(arena, 'arena');
    await capture(arena, info, 'full-arena');
    await bends(page, arena, phone, phone);
    await capture(arena, info, 'corner');
    await ride(page, 8);
    await capture(arena, info, 'crash');
    await ride(page, 22);
    await expect(arena).toHaveAttribute('data-round', '2');
    await capture(arena, info, 'next-round');
  });
}
