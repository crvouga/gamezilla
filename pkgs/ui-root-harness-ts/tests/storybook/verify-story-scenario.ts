// @io-wall-ok — browser verification adapter; all requests stay on the static server.
import { expect, type Page } from '@playwright/test';
import axe from 'axe-core';
import type { visualScenarios } from '../../storybook/scenarios';

/**
 * The same readiness and accessibility contract for every canvas. A story is
 * never compared against a stored picture of itself: what it must show is
 * asserted by its own `play` function and by the checks that open it.
 */
export async function verifyStoryScenario(
  page: Page,
  storyId: string,
  scenario: ReturnType<typeof visualScenarios>[number]
): Promise<void> {
  const { width, height, globals } = scenario;
  const globalsParam = Object.entries(globals)
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
  await page.setViewportSize({ width, height });
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort()
  );
  await page.goto(
    `/iframe.html?id=${storyId}&viewMode=story&globals=${globalsParam}`
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
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await page.evaluate(() => document.fonts.ready);
  const mixedLists = await page
    .locator('.panel[role="group"], [role="menu"]')
    .evaluateAll((lists) =>
      lists.flatMap((list) => {
        const slots = list.querySelectorAll(
          '[data-slot="row-leading"] > [data-icon-family], [role="menuitem"] > [data-icon-family], [role="menuitem"] > :first-child > [data-icon-family]'
        );
        const families = new Set(
          Array.from(slots)
            .filter(
              (slot) =>
                slot.closest('.panel[role="group"], [role="menu"]') === list
            )
            .map((slot) => slot.getAttribute('data-icon-family'))
        );
        return families.size > 1 ? [list.textContent] : [];
      })
    );
  expect(
    mixedLists,
    'Leading pictures in each list share one icon family'
  ).toEqual([]);
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
}
