// @io-wall-ok — browser verification adapter; all requests stay on the static server
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import axe from 'axe-core';
import { visualScenarios } from '../../storybook/scenarios';

type Entry = { id: string; type: string; importPath: string };
const index = JSON.parse(
  readFileSync(
    new URL('../../.cache/storybook/index.json', import.meta.url),
    'utf8'
  )
) as { entries: Record<string, Entry> };
for (const story of Object.values(index.entries).filter(
  (e) => e.type === 'story'
)) {
  for (const scenario of visualScenarios(story)) {
    const { width, theme, suffix } = scenario;
    test(`${story.id} ${theme}${suffix}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      const failures: string[] = [];
      page.on('pageerror', (error) => failures.push(error.message));
      await page.route('**/*', (route) =>
        new URL(route.request().url()).hostname === '127.0.0.1'
          ? route.continue()
          : route.abort()
      );
      await page.goto(
        `/iframe.html?id=${story.id}&viewMode=story&globals=theme:${theme}`
      );
      await expect(page.locator('#storybook-root')).toHaveAttribute(
        'data-story-ready',
        'true'
      );
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
    });
  }
}
