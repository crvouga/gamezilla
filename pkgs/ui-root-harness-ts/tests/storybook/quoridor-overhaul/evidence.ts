// @io-wall-ok — browser evidence instrumentation, never product runtime.
import { expect, type Page, type TestInfo } from '@playwright/test';
import axe from 'axe-core';
import { auditQuoridorAccessibility } from './accessibility';

/** Observe event-to-next-frame latency and long tasks during the real story play. */
export async function observeQuoridorInput(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // The highlight addon rescans every element on each DOM mutation; it is
    // Storybook tooling, not the board, so it stays off while measuring.
    Object.assign(globalThis, { __STORYBOOK_HIGHLIGHT_INITIALIZED: true });
    const samples: {
      event: string;
      trusted: boolean;
      milliseconds: number;
      handledMilliseconds: number | null;
    }[] = [];
    const longTasks: number[] = [];
    Object.assign(window, { quoridorMetrics: { samples, longTasks } });
    for (const type of ['click', 'keydown', 'pointerdown']) {
      const handled = new WeakMap<Event, number>();
      // Document bubble: the board's own handlers are done; the preview's
      // window-level key forwarding to the manager runs after this.
      document.addEventListener(type, (event) =>
        handled.set(event, performance.now())
      );
      document.addEventListener(
        type,
        (event) => {
          const start = performance.now();
          requestAnimationFrame(() => {
            const end = handled.get(event);
            samples.push({
              event: type,
              trusted: event.isTrusted,
              milliseconds: performance.now() - start,
              handledMilliseconds: end === undefined ? null : end - start,
            });
          });
        },
        true
      );
    }
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
  // Read timing before axe so its audit work is not counted as board long tasks.
  const metrics = await page.evaluate(
    () => (window as unknown as { quoridorMetrics: unknown }).quoridorMetrics
  );
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
  await info.attach(`${story}-metrics`, {
    body: JSON.stringify(
      {
        viewport: page.viewportSize(),
        theme,
        playMilliseconds,
        metrics,
        limits:
          'Metrics are read before the accessibility audit, with the Storybook highlight addon disabled. milliseconds is capture-phase dispatch to the next animation frame; handledMilliseconds is capture to document bubble, before the preview forwards keys to the manager. playMilliseconds is navigation to scripted-play completion, dominated by test-library pacing. Event dispatch to next animation frame, not hardware input latency. Story play may use synthetic events. CPU throttling approximates a slower CPU; it is not a physical mobile device.',
      },
      null,
      2
    ),
    contentType: 'application/json',
  });
}

/** Loads a story once before measurement so later captures start from a warm bundle. */
export async function warmQuoridorStory(
  page: Page,
  story: string,
  theme: string
): Promise<void> {
  await testStoryReady(page, story, theme);
}

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
    'true'
  );
  const playMilliseconds = Date.now() - started;
  await expect(page.locator('#storybook-root')).not.toHaveAttribute(
    'data-story-status',
    'error'
  );
  await page.evaluate(() => document.fonts.ready);
  return playMilliseconds;
}
