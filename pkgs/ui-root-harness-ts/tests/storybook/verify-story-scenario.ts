// @io-wall-ok — browser verification adapter; all requests stay on the static server.
import { expect, type Page } from '@playwright/test';
import axe from 'axe-core';
import type { visualScenarios } from '../../storybook/scenarios';

/** The same readiness, accessibility and pixel contract for every canvas. */
export async function verifyStoryScenario(
  page: Page,
  storyId: string,
  scenario: ReturnType<typeof visualScenarios>[number]
): Promise<void> {
  const { width, height, theme } = scenario;
  await page.setViewportSize({ width, height });
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort()
  );
  await page.goto(
    `/iframe.html?id=${storyId}&viewMode=story&globals=theme:${theme}`
  );
  await expect
    .poll(async () =>
      page.locator('#storybook-root').evaluate((root) => {
        const status = root.getAttribute('data-story-status');
        if (status === 'error')
          return `error: ${root.getAttribute('data-story-error') ?? 'Storybook reported a failure'}`;
        return root.getAttribute('data-story-ready') === 'true'
          ? 'success'
          : 'pending';
      })
    )
    .toBe('success');
  await expect(page.locator('.sb-errordisplay')).not.toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const root = document.querySelector<HTMLElement>('#storybook-root');
    if (!root) throw new Error('Storybook canvas is missing');
    const result = await (window as unknown as { axe: typeof axe }).axe.run(
      root
    );
    return result.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
  });
  expect(violations).toEqual([]);
  expect(failures).toEqual([]);
  await expect(page.locator('#storybook-root')).toHaveScreenshot(
    scenario.baseline.split('/'),
    { animations: 'disabled' }
  );
}
