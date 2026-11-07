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
export async function measureDrop(page: Page, column: number) {
  await page.evaluate(() => {
    const root = document.querySelector('#storybook-root');
    if (!root) throw new Error('Missing canvas');
    root.addEventListener(
      'click',
      () => {
        const start = performance.now();
        requestAnimationFrame(() => {
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
  await page.getByTestId(`custom-game-board-column-${column}`).click();
  await expect(board).not.toHaveAttribute('data-cells', before ?? '');
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-input-frame-ms',
    /.+/
  );
  return Number(
    await page.locator('#storybook-root').getAttribute('data-input-frame-ms')
  );
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
}
