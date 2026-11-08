// @io-wall-ok — browser measurement adapter; never imported by product code.
import { expect, type Page, type TestInfo } from '@playwright/test';
import axe from 'axe-core';
import { recordGeometry } from './geometry-evidence';
import { retainEvidence } from './retained-evidence';

/** Record native input and long tasks; values describe this browser run only. */
export async function observeInput(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const samples: {
      kind: string;
      duration: number;
      startTime: number;
      key?: string;
    }[] = [
      {
        kind: 'phase:loading-and-story-play',
        duration: 0,
        startTime: performance.now(),
      },
    ];
    Object.assign(window, { wordTilesSamples: samples });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        samples.push({
          kind: entry.entryType,
          duration: entry.duration,
          startTime: entry.startTime,
        });
    }).observe({ type: 'longtask', buffered: true });
    for (const kind of ['pointerup', 'keydown']) {
      document.addEventListener(
        kind,
        (event) => {
          if (!event.isTrusted) return;
          const start = performance.now();
          requestAnimationFrame(() => {
            samples.push({
              kind: `${kind}-to-frame`,
              duration: performance.now() - start,
              startTime: start,
              ...(event instanceof KeyboardEvent ? { key: event.key } : {}),
            });
          });
        },
        { capture: true }
      );
    }
  });
}

/** Timestamp phase boundaries; long tasks must be attributed by start time, not delivery time. */
export async function markEvidencePhase(
  page: Page,
  phase: string
): Promise<void> {
  await page.evaluate((name) => {
    const samples = (window as unknown as { wordTilesSamples?: unknown[] })
      .wordTilesSamples;
    samples?.push({
      kind: `phase:${name}`,
      duration: 0,
      startTime: performance.now(),
    });
  }, phase);
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
  await markEvidencePhase(page, 'ready');
}

/** Keep images and measurements on failure too; no baseline is auto-accepted. */
export async function recordEvidence(
  page: Page,
  info: TestInfo
): Promise<void> {
  await markEvidencePhase(page, 'evidence-capture');
  await recordGeometry(page, info);
  await retainEvidence(info, 'viewport.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await retainEvidence(info, 'board.png', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  const samples = await page.evaluate(
    () =>
      (window as unknown as { wordTilesSamples?: unknown[] })
        .wordTilesSamples ?? []
  );
  await retainEvidence(info, 'input-and-long-tasks.json', {
    body: JSON.stringify(
      {
        samples,
        limits:
          'Input-to-next-animation-frame proxy, not display presentation latency. Named task timings include Playwright auto-wait/scroll, asserted DOM state and two animation frames; not pure input latency. Desktop Chromium emulation; shared hosted CPU, not physical Android. Attribute timestamped long tasks to phase intervals; loading includes Storybook play. Audit and capture work are separate phases.',
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
  await markEvidencePhase(page, 'accessibility-audit');
  await page.addScriptTag({ content: axe.source });
  const result = await page.evaluate(() =>
    (window as unknown as { axe: typeof axe }).axe.run('#storybook-root')
  );
  await retainEvidence(info, 'accessibility.json', {
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
