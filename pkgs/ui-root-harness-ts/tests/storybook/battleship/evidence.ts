// @io-wall-ok — browser evidence adapter, never imported by product code.
import { expect, type Page, type TestInfo } from '@playwright/test';
import axe from 'axe-core';

export async function openBattleStory(page: Page, id: string, theme: string) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort()
  );
  await page.goto(
    `/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await expect(page.locator('#storybook-root')).not.toHaveAttribute(
    'data-story-status',
    'error'
  );
  await page.evaluate(() => document.fonts.ready);
  expect(errors).toEqual([]);
  return errors;
}

export async function captureBattleEvidence(page: Page, info: TestInfo) {
  await info.attach('board', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  await page.addScriptTag({ content: axe.source });
  const results = await page.evaluate(async () => {
    const root = document.querySelector<HTMLElement>('#storybook-root');
    if (!root) throw new Error('Missing Storybook root');
    return (window as unknown as { axe: typeof axe }).axe.run(root);
  });
  await info.attach('accessibility', {
    body: JSON.stringify(results),
    contentType: 'application/json',
  });
  expect(
    results.violations.filter(
      (item) => item.impact === 'serious' || item.impact === 'critical'
    )
  ).toEqual([]);
}
