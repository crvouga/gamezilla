// @io-wall-ok — browser evidence instrumentation, never product runtime.
import { expect, type Page, type TestInfo } from '@playwright/test';
import axe from 'axe-core';

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
  await testStoryReady(page, story, theme);
  await page.addScriptTag({ content: axe.source });
  const accessibility = await page.evaluate(async () => {
    const result = await (window as unknown as { axe: typeof axe }).axe.run(
      '#storybook-root'
    );
    return result.violations;
  });
  await info.attach(`${story}-accessibility`, {
    body: JSON.stringify(accessibility, null, 2),
    contentType: 'application/json',
  });
  expect(
    accessibility.filter(
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
        metrics,
        limits:
          'Event dispatch to next animation frame, not hardware input latency. Story play may use synthetic events. CPU throttling approximates a slower CPU; it is not a physical mobile device.',
      },
      null,
      2
    ),
    contentType: 'application/json',
  });
}

async function testStoryReady(page: Page, story: string, theme: string) {
  await page.goto(
    `/iframe.html?id=${story}&viewMode=story&globals=theme:${theme}`
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
