// @io-wall-ok — browser evidence adapter; the test runner owns the browser.
import { expect, type Page, type TestInfo } from '@playwright/test';
import axe from 'axe-core';
import { attachHeartsText } from './attachments';
import { diagnoseContrast } from './contrast-diagnostic';

/** What every Hearts timing excludes and runs with, stated in each report. */
export const HEARTS_TIMING_CONDITIONS = {
  motion: 'system motion, normal (prefers-reduced-motion: no-preference)',
  excluded: [
    'Storybook highlight addon DOM rescans (__STORYBOOK_HIGHLIGHT_INITIALIZED)',
    'Storybook preview key forwarding to the manager (window.onkeydown)',
  ],
} as const;

/** Evidence runs with real motion: the story follows the browser, and the
 * browser asks for normal motion unless a check says otherwise. */
export async function openHearts(
  page: Page,
  story: string,
  theme: string,
  reducedMotion: 'no-preference' | 'reduce' = 'no-preference'
) {
  await page.emulateMedia({ reducedMotion });
  // Storybook's own work is not the game's: the highlight addon rescans
  // every element on each change, and the preview forwards each key press
  // to the manager. Timings exclude both; Hearts' listeners are untouched.
  await page.addInitScript(() => {
    const preview = globalThis as unknown as Record<string, unknown>;
    preview['__STORYBOOK_HIGHLIGHT_INITIALIZED'] = true;
    Object.defineProperty(window, 'onkeydown', {
      configurable: true,
      get: () => null,
      set: () => undefined,
    });
  });
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort()
  );
  await page.goto(
    `/iframe.html?id=${story}&viewMode=story&globals=theme:${theme};motion:system`
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
  const path = info.outputPath(`${name}.png`);
  // Stills finish any motion first; videos keep it.
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  await info.attach(name, {
    path,
    contentType: 'image/png',
  });
  await attachHeartsText(
    info,
    `${name}-accessibility-tree.txt`,
    await page.locator('#storybook-root').ariaSnapshot()
  );
}

export async function auditHearts(page: Page, info: TestInfo) {
  await page.addScriptTag({ content: axe.source });
  const result = await page.evaluate(async () => {
    const root = document.querySelector<HTMLElement>('#storybook-root');
    if (!root) throw new Error('Missing Hearts canvas');
    return (window as unknown as { axe: typeof axe }).axe.run(root);
  });
  await attachHeartsText(
    info,
    'axe-results.json',
    JSON.stringify(result, null, 2)
  );
  const unresolved = result.incomplete
    .filter((rule) => rule.id === 'color-contrast')
    .flatMap((rule) => rule.nodes.map((node) => String(node.target[0])));
  const contrast = await diagnoseContrast(page, unresolved);
  await attachHeartsText(
    info,
    'contrast-diagnostic.json',
    JSON.stringify(contrast, null, 2)
  );
  expect(
    contrast.filter(
      (finding) => finding.ratio !== null && finding.ratio < finding.required
    )
  ).toEqual([]);
  expect(
    result.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    )
  ).toEqual([]);
}
