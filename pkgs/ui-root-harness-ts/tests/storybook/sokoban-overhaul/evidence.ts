// @io-wall-ok — automated browser evidence, using the test-owned Storybook server.
import { expect, type Page, type TestInfo } from '@playwright/test';
import axe from 'axe-core';

export async function openSokoban(page: Page, story: string, theme: string) {
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort()
  );
  // Storybook's highlight addon re-scans every element on each DOM change;
  // it is dev tooling, not the game, so it stays off for timing evidence.
  await page.addInitScript(() => {
    (
      globalThis as { __STORYBOOK_HIGHLIGHT_INITIALIZED?: boolean }
    ).__STORYBOOK_HIGHLIGHT_INITIALIZED = true;
  });
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

/** Scan the story with axe; `state` names the report, so scans in one test
 *  keep separate files. */
export async function accessibility(
  page: Page,
  info: TestInfo,
  state = 'fresh'
) {
  await page.addScriptTag({ content: axe.source });
  const result = await page.evaluate(async () => {
    const root = document.querySelector<HTMLElement>('#storybook-root');
    if (!root) throw new Error('Missing canvas');
    return (window as unknown as { axe: typeof axe }).axe.run(root);
  });
  await info.attach(`accessibility-${state}.json`, {
    body: JSON.stringify(result, null, 2),
    contentType: 'application/json',
  });
  // A summary in the job log, readable from the hosted run itself.
  process.stdout.write(
    `SOKOBAN_AXE ${JSON.stringify({
      test: info.title,
      state,
      violations: result.violations.map((item) => [item.id, item.nodes.length]),
      incomplete: result.incomplete.map((item) => [item.id, item.nodes.length]),
      passes: result.passes.length,
    })}\n`
  );
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
