// @io-wall-ok — browser evidence adapter, never imported by product code.
import { expect, type Page, type TestInfo } from '@playwright/test';
import axe, { type AxeResults } from 'axe-core';

export async function openBattleStory(
  page: Page,
  id: string,
  theme: string,
  info?: TestInfo
) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort()
  );
  await page.goto(
    // `motion:system`: the browser decides, so videos and timings include the
    // board's real transitions instead of the preview's forced reduced motion.
    `/iframe.html?id=${id}&viewMode=story&globals=theme:${theme};motion:system`
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  // Recorded before the play verdict, so an overflow failure shows its boxes.
  if (info) {
    const layout = await captureBattleLayout(page, info);
    // The log carries the boxes too: retained artifacts need bucket access.
    if (layout.storyError !== null)
      throw new Error(`${layout.storyError}\n${JSON.stringify(layout)}`);
  }
  await expect(page.locator('#storybook-root')).not.toHaveAttribute(
    'data-story-status',
    'error'
  );
  await page.evaluate(() => document.fonts.ready);
  expect(errors).toEqual([]);
  return errors;
}

export async function captureBattleEvidence(page: Page, info: TestInfo) {
  await info.attach('board', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  await page.addScriptTag({ content: axe.source });
  const results = await page.evaluate(async () => {
    const root = document.querySelector<HTMLElement>('#storybook-root');
    if (!root) throw new Error('Missing Storybook root');
    return (window as unknown as { axe: typeof axe }).axe.run(root);
  });
  await info.attach('accessibility', {
    body: JSON.stringify(results),
    contentType: 'application/json',
  });
  await info.attach('accessibility-incomplete', {
    body: JSON.stringify(await incompleteSummary(page, results)),
    contentType: 'application/json',
  });
  expect(
    results.violations.filter(
      (item) => item.impact === 'serious' || item.impact === 'critical'
    )
  ).toEqual([]);
}

/** Per-cell ids repeat 100 times per board; the probe keeps the surfaces. */
const CELL_ID = /-(target|aim|own|area|setup|place)-[a-j]?\d+$/i;

/** Boxes of the board's surfaces and the frame around them, in CSS pixels. */
export async function captureBattleLayout(page: Page, info: TestInfo) {
  const layout = await page.evaluate((cellPattern) => {
    const cell = new RegExp(cellPattern, 'i');
    const boxes = [...document.querySelectorAll<HTMLElement>('[data-testid]')]
      .filter((element) => !cell.test(element.dataset['testid'] ?? ''))
      .slice(0, 80)
      .map((element) => {
        const box = element.getBoundingClientRect();
        return {
          testId: element.dataset['testid'],
          top: Math.round(box.top),
          bottom: Math.round(box.bottom),
          left: Math.round(box.left),
          right: Math.round(box.right),
        };
      });
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      documentHeight: document.documentElement.scrollHeight,
      storyError:
        document
          .querySelector('#storybook-root')
          ?.getAttribute('data-story-error') ?? null,
      boxes,
    };
  }, CELL_ID.source);
  await info.attach('layout', {
    body: JSON.stringify(layout),
    contentType: 'application/json',
  });
  return layout;
}

/**
 * Zero violations is not contrast coverage: count what axe could not decide,
 * by rule and reason, and for undecided contrast record what covers the
 * node's centre and its computed colours (bounded to 12 nodes).
 */
async function incompleteSummary(page: Page, results: AxeResults) {
  const reasons: Record<string, number> = {};
  const targets: string[] = [];
  for (const rule of results.incomplete)
    for (const node of rule.nodes) {
      const keys = [...node.any, ...node.all, ...node.none].map(
        (check) =>
          `${rule.id}:${(check.data as { messageKey?: string } | null)?.messageKey ?? check.id}`
      );
      for (const key of keys) reasons[key] = (reasons[key] ?? 0) + 1;
      if (rule.id === 'color-contrast' && targets.length < 12)
        targets.push(String(node.target[0]));
    }
  const contrast = await page.evaluate((selectors) => {
    return selectors.map((selector) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return { selector, missing: true };
      const box = element.getBoundingClientRect();
      const stack = document
        .elementsFromPoint(box.left + box.width / 2, box.top + box.height / 2)
        .slice(0, 6)
        .map((hit) => {
          const style = getComputedStyle(hit);
          return {
            tag: hit.tagName.toLowerCase(),
            testId: (hit as HTMLElement).dataset['testid'] ?? null,
            component: (hit as HTMLElement).dataset['component'] ?? null,
            position: style.position,
            background: style.backgroundColor,
            backgroundImage: style.backgroundImage === 'none' ? null : 'set',
            opacity: style.opacity,
          };
        });
      const own = getComputedStyle(element);
      return {
        selector,
        color: own.color,
        background: own.backgroundColor,
        hitStack: stack,
      };
    });
  }, targets);
  return {
    incompleteRules: results.incomplete.map((rule) => ({
      id: rule.id,
      nodes: rule.nodes.length,
    })),
    reasons,
    contrast,
  };
}
