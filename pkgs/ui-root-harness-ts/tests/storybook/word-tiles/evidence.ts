// @io-wall-ok — browser measurement adapter; never imported by product code.
import { expect, type Page, type TestInfo } from '@playwright/test';
import axe from 'axe-core';

/** Record native input and long tasks; values describe this browser run only. */
export async function observeInput(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const samples: { kind: string; duration: number }[] = [];
    Object.assign(window, { wordTilesSamples: samples });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        samples.push({ kind: entry.entryType, duration: entry.duration });
    }).observe({ type: 'longtask', buffered: true });
    for (const kind of ['pointerup', 'keydown']) {
      document.addEventListener(
        kind,
        () => {
          const start = performance.now();
          requestAnimationFrame(() => {
            samples.push({
              kind: `${kind}-to-frame`,
              duration: performance.now() - start,
            });
          });
        },
        { capture: true }
      );
    }
  });
}

/** Await the repository's native Storybook play outcome, including failures. */
export async function openStory(
  page: Page,
  story: string,
  theme: string
): Promise<void> {
  await page.goto(
    `/iframe.html?id=screens-games-word-tiles-board--${story}&viewMode=story&globals=theme:${theme}`
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
}

/** Keep images and measurements on failure too; no baseline is auto-accepted. */
export async function recordEvidence(
  page: Page,
  info: TestInfo
): Promise<void> {
  await info.attach('board.png', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  const samples = await page.evaluate(
    () =>
      (window as unknown as { wordTilesSamples?: unknown[] })
        .wordTilesSamples ?? []
  );
  await info.attach('input-and-long-tasks.json', {
    body: JSON.stringify(
      {
        samples,
        limits:
          'Input-to-next-animation-frame proxy, not display presentation latency. Desktop Chromium emulation; shared hosted CPU, not physical Android. Long tasks include story loading.',
      },
      null,
      2
    ),
    contentType: 'application/json',
  });
}

export async function auditAccessibility(
  page: Page,
  info: TestInfo
): Promise<void> {
  await page.addScriptTag({ content: axe.source });
  const result = await page.evaluate(() =>
    (window as unknown as { axe: typeof axe }).axe.run('#storybook-root')
  );
  await info.attach('accessibility.json', {
    body: JSON.stringify(
      { violations: result.violations, incomplete: result.incomplete },
      null,
      2
    ),
    contentType: 'application/json',
  });
  expect(
    result.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    )
  ).toEqual([]);
}
