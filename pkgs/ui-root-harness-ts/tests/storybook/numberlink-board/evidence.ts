// @io-wall-ok — automated browser evidence adapter.

import { writeFile } from 'node:fs/promises';
import { expect, type Page, type TestInfo } from '@playwright/test';
import axe from 'axe-core';

export async function openStory(
  page: Page,
  theme: string,
  story = 'screens-games-numberlink-puzzle--draw-paths'
) {
  await page.goto(
    `/iframe.html?id=${story}&viewMode=story&globals=theme:${theme}`
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
}

/**
 * Saves a JSON record beside the case's captures. In-memory attachments
 * only reach the report and the trace, so a case recorded without a trace
 * would otherwise lose its measurements from the retained evidence.
 */
export async function attachJson(info: TestInfo, name: string, value: unknown) {
  const path = info.outputPath(`${name}.json`);
  await writeFile(path, JSON.stringify(value, null, 2));
  await info.attach(name, { path, contentType: 'application/json' });
}

export async function openBoard(
  page: Page,
  theme: string,
  story = 'screens-games-numberlink-puzzle--draw-paths'
) {
  await openStory(page, theme, story);
  await page.getByTestId('numberlink-board').scrollIntoViewIfNeeded();
}

export async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  await info.attach(name, { path, contentType: 'image/png' });
  const geometry = await page.evaluate(() => {
    const selectors = [
      '[data-testid="numberlink-board"]',
      '[data-testid="numberlink-progress"]',
      '[data-testid="puzzle-attempt-panel"]',
      '[data-testid="puzzle-attempt-figures"]',
    ];
    return selectors.map((selector) => {
      const element = document.querySelector(selector);
      const box = element?.getBoundingClientRect();
      return {
        selector,
        box: box
          ? { x: box.x, y: box.y, width: box.width, height: box.height }
          : null,
        text: element?.textContent,
      };
    });
  });
  await attachJson(info, `${name}-geometry`, geometry);
}

export async function accessibility(page: Page, info: TestInfo) {
  await page.addScriptTag({ content: axe.source });
  const results = await page.evaluate(async () => {
    const scanner = (window as unknown as { axe: typeof axe }).axe;
    const root = document.querySelector<HTMLElement>('#storybook-root');
    if (!root) throw new Error('Storybook canvas is missing');
    return scanner.run(root);
  });
  await attachJson(info, 'accessibility', results.violations);
  expect(
    results.violations.filter(
      (item) => item.impact === 'serious' || item.impact === 'critical'
    )
  ).toEqual([]);
}

export async function center(page: Page, index: number) {
  const cell = page.getByTestId(`numberlink-board-cell-${index}`);
  const box = await cell.boundingBox();
  if (!box) throw new Error(`Missing cell ${index}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export async function mousePath(page: Page, cells: readonly number[]) {
  const first = cells[0];
  if (first === undefined) throw new Error('A mouse path needs a start');
  const start = await center(page, first);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const cell of cells.slice(1)) {
    const point = await center(page, cell);
    await page.mouse.move(point.x, point.y);
  }
  await page.mouse.up();
}

export async function touchPath(page: Page, cells: readonly number[]) {
  const session = await page.context().newCDPSession(page);
  const first = cells[0];
  if (first === undefined) throw new Error('A touch path needs a start');
  const start = await center(page, first);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...start, id: 1 }],
  });
  for (const cell of cells.slice(1)) {
    const point = await center(page, cell);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ ...point, id: 1 }],
    });
  }
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await session.detach();
}
