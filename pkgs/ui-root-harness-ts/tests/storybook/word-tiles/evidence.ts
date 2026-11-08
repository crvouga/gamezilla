// @io-wall-ok — browser measurement adapter; never imported by product code.
import { expect, type Page, type TestInfo } from '@playwright/test';
import axe, { type Result } from 'axe-core';
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

/**
 * Await the repository's native Storybook play outcome, including failures.
 * `motion:system` lets the browser's motion preference decide, so videos and
 * timings include real animation instead of the preview's reduced motion.
 */
export async function openStory(
  page: Page,
  story: string,
  theme: string
): Promise<void> {
  await page.goto(
    `/iframe.html?id=screens-games-word-tiles-board--${story}&viewMode=story&globals=theme:${theme};motion:system`
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
  await retainEvidence(info, 'contrast-diagnostic.json', {
    body: JSON.stringify(await contrastDiagnostic(page, result.incomplete)),
    contentType: 'application/json',
  });
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

/**
 * Axe leaves contrast incomplete when it cannot resolve a background. For a
 * bounded sample, keep the reason, computed colours, box and hit stack, so the
 * cause is inspected rather than assumed. Zero violations is not coverage.
 */
async function contrastDiagnostic(
  page: Page,
  incomplete: readonly Result[]
): Promise<unknown> {
  const nodes = incomplete
    .filter((rule) => rule.id === 'color-contrast')
    .flatMap((rule) => rule.nodes);
  const reasons: Record<string, number> = {};
  for (const node of nodes)
    for (const check of [...node.any, ...node.all, ...node.none]) {
      const key =
        (check.data as { messageKey?: string } | null)?.messageKey ??
        check.message;
      reasons[key] = (reasons[key] ?? 0) + 1;
    }
  const sample = nodes.slice(0, 12).map((node) => ({
    target: String(node.target[0]),
    reasons: node.any.map(
      (check) =>
        (check.data as { messageKey?: string } | null)?.messageKey ?? null
    ),
  }));
  const details = await page.evaluate(
    (targets) => {
      return targets.map((target) => {
        const element = document.querySelector<HTMLElement>(target);
        if (!element) return { target, missing: true };
        const rect = element.getBoundingClientRect();
        const css = getComputedStyle(element);
        const stack = document
          .elementsFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
          .slice(0, 6)
          .map((hit) => ({
            tag: hit.tagName,
            component: (hit as HTMLElement).dataset['component'] ?? null,
            background: getComputedStyle(hit).backgroundColor,
            backgroundImage: getComputedStyle(hit).backgroundImage.slice(0, 80),
            position: getComputedStyle(hit).position,
          }));
        return {
          target,
          text: element.textContent.trim().slice(0, 40),
          color: css.color,
          background: css.backgroundColor,
          box: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          stack,
        };
      });
    },
    sample.map((entry) => entry.target)
  );
  return {
    nodes: nodes.length,
    reasons,
    sample: sample.map((entry, index) => ({ ...entry, ...details[index] })),
    limits:
      'First 12 incomplete contrast nodes only; hit stack at box centre. Diagnostic, not a contrast pass.',
  };
}
