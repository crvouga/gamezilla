// @io-wall-ok — automated browser evidence, using the test-owned Storybook server.
import { expect, type Page, type TestInfo } from '@playwright/test';
import axe from 'axe-core';

export async function openSokoban(page: Page, story: string, theme: string) {
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort()
  );
  await page.goto(
    `/iframe.html?id=screens-games-sokoban-${story}&viewMode=story&globals=theme:${theme}`
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await expect(page.locator('.sb-errordisplay')).not.toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

export async function capture(page: Page, info: TestInfo, state: string) {
  const path = info.outputPath(`${state}.png`);
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  await info.attach(state, { path, contentType: 'image/png' });
}

export async function accessibility(page: Page, info: TestInfo) {
  await page.addScriptTag({ content: axe.source });
  const result = await page.evaluate(async () => {
    const root = document.querySelector<HTMLElement>('#storybook-root');
    if (!root) throw new Error('Missing canvas');
    return (window as unknown as { axe: typeof axe }).axe.run(root);
  });
  await info.attach('accessibility.json', {
    body: JSON.stringify(result, null, 2),
    contentType: 'application/json',
  });
  expect(
    result.violations.filter(
      (item) => item.impact === 'serious' || item.impact === 'critical'
    )
  ).toEqual([]);
}

export async function counts(page: Page, moves: number, pushes?: number) {
  const status = page.getByTestId('sokoban-counts');
  await expect(status).toHaveAttribute('data-moves', String(moves));
  if (pushes !== undefined)
    await expect(status).toHaveAttribute('data-pushes', String(pushes));
}
