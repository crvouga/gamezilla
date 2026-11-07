import { expect, type Page } from '@playwright/test';

/** The story uses synthetic touches; this also drives trusted input with native pointer capture restored. */
export async function verifySharedSwipeCapture(page: Page): Promise<void> {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    '/iframe.html?id=screens-games-light-cycles-arena--shared-swipe&viewMode=story&globals=theme:light'
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  const arena = page.getByTestId('custom-game-board-arena');
  await arena.scrollIntoViewIfNeeded();
  const bounds = await arena.boundingBox();
  if (!bounds) throw new Error('Missing shared arena');
  const y = bounds.y + bounds.height * 0.5;
  for (const [fraction, distance, rider, heading] of [
    [0.75, 40, 0, 'right'],
    [0.25, -40, 1, 'left'],
  ] as const) {
    const x = bounds.x + bounds.width * fraction;
    await page.mouse.move(x, y);
    await page.mouse.down();
    expect(
      await arena.evaluate((element) => element.hasPointerCapture(1))
    ).toBe(true);
    await page.mouse.move(x + distance, y, { steps: 4 });
    await page.mouse.up();
    await expect(
      page.getByTestId(`custom-game-board-arena-rider-${rider}`)
    ).toHaveAttribute('data-heading', heading);
  }
  expect(failures).toEqual([]);
}
