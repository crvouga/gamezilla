// @io-wall-ok — browser evidence instrumentation, never product runtime.
import { expect, type Page, type TestInfo } from '@playwright/test';
import axe from 'axe-core';
import { auditQuoridorAccessibility } from './accessibility';

/** Observe event-to-next-frame latency and long tasks during the real story play. */
export async function observeQuoridorInput(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const samples: { event: string; trusted: boolean; milliseconds: number }[] =
      [];
    const longTasks: number[] = [];
    Object.assign(window, { quoridorMetrics: { samples, longTasks } });
    for (const type of ['click', 'keydown', 'pointerdown'])
      document.addEventListener(
        type,
        (event) => {
          const start = performance.now();
          requestAnimationFrame(() =>
            samples.push({
              event: type,
              trusted: event.isTrusted,
              milliseconds: performance.now() - start,
            })
          );
        },
        true
      );
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTasks.push(entry.duration);
    }).observe({ type: 'longtask', buffered: true });
  });
}

export async function recordQuoridorState(
  page: Page,
  info: TestInfo,
  story: string,
  theme: string
): Promise<void> {
  const playMilliseconds = await testStoryReady(page, story, theme);
  await page.addScriptTag({ content: axe.source });
  const accessibility = await page.evaluate(auditQuoridorAccessibility);
  await info.attach(`${story}-accessibility`, {
    body: JSON.stringify(accessibility, null, 2),
    contentType: 'application/json',
  });
  expect(
    accessibility.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    )
  ).toEqual([]);
  await info.attach(`${story}-${theme}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  const metrics = await page.evaluate(
    () => (window as unknown as { quoridorMetrics: unknown }).quoridorMetrics
  );
  await info.attach(`${story}-metrics`, {
    body: JSON.stringify(
      {
        viewport: page.viewportSize(),
        theme,
        playMilliseconds,
        metrics,
        limits:
          'playMilliseconds is navigation to scripted-play completion, dominated by test-library pacing. Event dispatch to next animation frame, not hardware input latency. Story play may use synthetic events. CPU throttling approximates a slower CPU; it is not a physical mobile device.',
      },
      null,
      2
    ),
    contentType: 'application/json',
  });
}

/** Long journeys at 4x CPU throttling outlast the default 5s; the duration is reported, not hidden. */
const STORY_PLAY_DEADLINE_MS = 30_000;

async function testStoryReady(
  page: Page,
  story: string,
  theme: string
): Promise<number> {
  const started = Date.now();
  await page.goto(
    `/iframe.html?id=${story}&viewMode=story&globals=theme:${theme}`
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true',
    { timeout: STORY_PLAY_DEADLINE_MS }
  );
  const playMilliseconds = Date.now() - started;
  await expect(page.locator('#storybook-root')).not.toHaveAttribute(
    'data-story-status',
    'error'
  );
  await page.evaluate(() => document.fonts.ready);
  return playMilliseconds;
}
