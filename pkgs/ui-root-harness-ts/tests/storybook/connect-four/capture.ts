// @io-wall-ok — browser evidence adapter; measured time belongs to the browser.
import { expect, type Page, type TestInfo } from '@playwright/test';
import axe from 'axe-core';

/** Same deterministic browser setup for every immutable review round. */
export async function openBoard(page: Page, story: string, theme: string) {
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort()
  );
  await page.goto(
    `/iframe.html?id=screens-games-connect-four-board--${story}&viewMode=story&globals=theme:${theme}`
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await expect(page.locator('.sb-errordisplay')).not.toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/** Input-to-next-frame opportunity, not a physical display latency claim. */
export async function measureDrop(
  page: Page,
  column: number,
  input: 'click' | 'touch' | 'keyboard' = 'click'
) {
  await page.evaluate(() => {
    const root = document.querySelector('#storybook-root');
    if (!root) throw new Error('Missing canvas');
    root.addEventListener(
      'click',
      () => {
        const start = performance.now();
        const board = root.querySelector('[data-testid="custom-game-board"]');
        const before = board?.getAttribute('data-cells');
        requestAnimationFrame(() => {
          root.setAttribute(
            'data-updated-at-frame',
            String(board?.getAttribute('data-cells') !== before)
          );
          root.setAttribute(
            'data-input-frame-ms',
            String(performance.now() - start)
          );
        });
      },
      { once: true, capture: true }
    );
    root.removeAttribute('data-input-frame-ms');
  });
  const board = page.getByTestId('custom-game-board');
  const before = await board.getAttribute('data-cells');
  const control = page.getByTestId(`custom-game-board-column-${column}`);
  if (input === 'touch') await control.tap();
  else if (input === 'keyboard') await control.press('Space');
  else await control.click();
  await expect(board).not.toHaveAttribute('data-cells', before ?? '');
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-input-frame-ms',
    /.+/
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-updated-at-frame',
    'true'
  );
  const oldCells = JSON.parse(before ?? '[]') as number[];
  const newCells = JSON.parse(
    (await board.getAttribute('data-cells')) ?? '[]'
  ) as number[];
  expect(
    newCells.filter((value, index) => value !== oldCells[index])
  ).toHaveLength(1);
  expect(
    oldCells.every((value, index) => value === 0 || value === newCells[index])
  ).toBe(true);
  return {
    input,
    milliseconds: Number(
      await page.locator('#storybook-root').getAttribute('data-input-frame-ms')
    ),
  };
}

/** Keep all axe findings and target dimensions, including nonblocking findings. */
export async function captureBoard(page: Page, info: TestInfo, name: string) {
  await page.addScriptTag({ content: axe.source });
  const accessibility = await page.evaluate(async () => {
    const root = document.querySelector<HTMLElement>('#storybook-root');
    if (!root) throw new Error('Missing canvas');
    const result = await (window as unknown as { axe: typeof axe }).axe.run(
      root
    );
    return result.violations;
  });
  const columns = await page.locator('[data-column]').evaluateAll((items) =>
    items.map((item) => {
      const rect = item.getBoundingClientRect();
      return {
        label: item.getAttribute('aria-label'),
        disabled: item.getAttribute('aria-disabled'),
        width: rect.width,
        height: rect.height,
        inViewport: rect.left >= 0 && rect.right <= innerWidth,
      };
    })
  );
  await info.attach(`${name}-audit`, {
    body: JSON.stringify({ accessibility, columns }, null, 2),
    contentType: 'application/json',
  });
  await info.attach(name, {
    body: await page.screenshot({
      path: info.outputPath(`${name}.png`),
      fullPage: true,
    }),
    contentType: 'image/png',
  });
  expect(
    accessibility.filter((v) =>
      ['serious', 'critical'].includes(v.impact ?? '')
    )
  ).toEqual([]);
  expect(columns).toHaveLength(7);
  expect(columns.every((column) => column.inViewport)).toBe(true);
  // WCAG 2.2 AA target minimum; raw geometry also exposes the larger UI goal.
  expect(
    columns.every((column) => column.width >= 24 && column.height >= 24)
  ).toBe(true);
}
