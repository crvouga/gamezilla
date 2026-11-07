// @io-wall-ok — browser evidence adapter; the test runner owns the browser.
import { expect, type Page, type TestInfo } from '@playwright/test';
import axe from 'axe-core';

export async function openHearts(page: Page, story: string, theme: string) {
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort()
  );
  await page.goto(
    `/iframe.html?id=${story}&viewMode=story&globals=theme:${theme}`
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-status',
    'success'
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
}

export async function captureHearts(page: Page, info: TestInfo, name: string) {
  await info.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  await info.attach(`${name}-accessibility-tree`, {
    body: await page.locator('#storybook-root').ariaSnapshot(),
    contentType: 'text/plain',
  });
}

export async function auditHearts(page: Page, info: TestInfo) {
  await page.addScriptTag({ content: axe.source });
  const result = await page.evaluate(async () => {
    const root = document.querySelector<HTMLElement>('#storybook-root');
    if (!root) throw new Error('Missing Hearts canvas');
    return (window as unknown as { axe: typeof axe }).axe.run(root);
  });
  await info.attach('axe-results', {
    body: JSON.stringify(result, null, 2),
    contentType: 'application/json',
  });
  expect(
    result.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    )
  ).toEqual([]);
}
