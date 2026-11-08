// @io-wall-ok — automated browser evidence observes browser timing and writes test artifacts.
import { expect, type Page, type TestInfo } from '@playwright/test';
import axe from 'axe-core';

/** `system` lets the browser's motion preference decide; default is reduced. */
export async function openChessStory(
  page: Page,
  id: string,
  theme: string,
  motion: 'reduced' | 'system' = 'reduced'
) {
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort()
  );
  // Storybook's highlight addon rescans every element on each DOM change in
  // the story root; it is dev tooling, so it must not inflate app timings.
  await page.addInitScript(() => {
    (
      globalThis as { __STORYBOOK_HIGHLIGHT_INITIALIZED?: boolean }
    ).__STORYBOOK_HIGHLIGHT_INITIALIZED = true;
  });
  await page.goto(
    `/iframe.html?id=${id}&viewMode=story&globals=theme:${theme};motion:${motion}`
  );
  try {
    await expect(page.locator('#storybook-root')).toHaveAttribute(
      'data-story-ready',
      'true'
    );
    await expect(page.locator('#storybook-root')).not.toHaveAttribute(
      'data-story-status',
      'error'
    );
  } catch (error) {
    // Retained artifacts are not always reachable: the failure message
    // carries the board's layout chain into the hosted test log.
    throw new Error(
      `chess-geometry ${id} ${JSON.stringify(await boardGeometry(page))}`,
      { cause: error }
    );
  }
  await page.evaluate(() => document.fonts.ready);
}

/** The first square and each ancestor's box, padding and overflow. */
async function boardGeometry(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('#storybook-root');
    const square = document.querySelector<HTMLElement>('button[data-square]');
    const chain = [];
    for (
      let node: HTMLElement | null = square;
      node && chain.length < 24;
      node = node.parentElement
    ) {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      chain.push({
        tag: node.tagName.toLowerCase(),
        component: node.dataset['component'] ?? null,
        className: node.className.slice(0, 60),
        box: [box.left, box.top, box.width, box.height].map(Math.round),
        padding: style.padding,
        border: style.borderWidth,
        overflow: `${style.overflowX}/${style.overflowY}`,
        scroll: [node.scrollWidth, node.scrollHeight, node.clientWidth],
      });
    }
    return {
      viewport: [innerWidth, innerHeight],
      error: root?.getAttribute('data-story-error') ?? null,
      chain,
    };
  });
}

export async function captureChessState(
  page: Page,
  info: TestInfo,
  name: string
) {
  await info.attach(name, {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });
  await page.addScriptTag({ content: axe.source });
  const result = await page.evaluate(async () => {
    const root = document.querySelector<HTMLElement>('#storybook-root');
    if (!root) throw new Error('Missing story canvas');
    const report = await (window as unknown as { axe: typeof axe }).axe.run(
      root
    );
    // Incomplete results are retained: zero violations is not coverage.
    const summarize = (results: typeof report.incomplete) =>
      results.map((rule) => ({
        id: rule.id,
        impact: rule.impact,
        nodeCount: rule.nodes.length,
        messageKeys: [
          ...new Set(
            rule.nodes.flatMap((node) =>
              [...node.any, ...node.all, ...node.none].map(
                (check) =>
                  (check.data as { messageKey?: string } | null)?.messageKey ??
                  check.id
              )
            )
          ),
        ],
        targets: rule.nodes.slice(0, 20).map((node) => node.target),
      }));
    // Bounded diagnostic for undecided contrast: what sits under each node.
    const contrast = report.incomplete
      .filter((rule) => rule.id === 'color-contrast')
      .flatMap((rule) => rule.nodes)
      .slice(0, 12)
      .map((node) => {
        const selector = String(node.target[0] ?? '');
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) return { selector, missing: true };
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const stack = document
          .elementsFromPoint(box.x + box.width / 2, box.y + box.height / 2)
          .slice(0, 6)
          .map((under) => {
            const look = getComputedStyle(under);
            return {
              tag: under.tagName.toLowerCase(),
              component: (under as HTMLElement).dataset['component'] ?? null,
              background: look.backgroundColor,
              backgroundImage: look.backgroundImage === 'none' ? null : 'set',
              opacity: look.opacity,
            };
          });
        return {
          selector,
          messageKey: (node.any[0]?.data as { messageKey?: string } | null)
            ?.messageKey,
          color: style.color,
          background: style.backgroundColor,
          stack,
        };
      });
    return {
      violations: report.violations,
      incomplete: summarize(report.incomplete),
      contrast,
      passes: report.passes.map((rule) => rule.id),
    };
  });
  await info.attach(`${name}-accessibility`, {
    body: JSON.stringify(result, null, 2),
    contentType: 'application/json',
  });
  expect(
    result.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    )
  ).toEqual([]);
}

export async function squareCenter(page: Page, square: string) {
  const bounds = await page.locator(`[data-square="${square}"]`).boundingBox();
  if (!bounds) throw new Error(`Missing square ${square}`);
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

export async function measureChessInput(page: Page, info: TestInfo) {
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const measurements = await page.evaluate(async () => {
    const source = document.querySelector<HTMLElement>('[data-square="e2"]');
    if (!source) throw new Error('Missing e2');
    const press = (key: string) =>
      source.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      );
    const frames = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
    const samples: {
      synchronousMs: number;
      inputThroughTwoFramesMs: number;
      longTasks: number[];
      selected: string | null;
    }[] = [];
    // Time to the document's bubble phase, then stop there: the preview's
    // window keydown forwarding to the Storybook manager is not the app.
    let reached = 0;
    const atDocument = (event: KeyboardEvent) => {
      reached = performance.now();
      event.stopPropagation();
    };
    document.addEventListener('keydown', atDocument);
    source.focus();
    // Sample 0 is cold; later samples repeat select after Escape cancels.
    for (let index = 0; index < 8; index += 1) {
      const longTasks: number[] = [];
      const observer = new PerformanceObserver((list) => {
        longTasks.push(...list.getEntries().map((entry) => entry.duration));
      });
      observer.observe({ type: 'longtask', buffered: false });
      const start = performance.now();
      press('Enter');
      const synchronousMs = reached - start;
      await frames();
      const inputThroughTwoFramesMs = performance.now() - start;
      longTasks.push(...observer.takeRecords().map((entry) => entry.duration));
      observer.disconnect();
      samples.push({
        synchronousMs,
        inputThroughTwoFramesMs,
        longTasks,
        selected: source.getAttribute('aria-pressed'),
      });
      press('Escape');
      await frames();
    }
    // Leave e2 selected for the journey that follows, as a single sample did.
    press('Enter');
    await frames();
    document.removeEventListener('keydown', atDocument);
    const sorted = samples
      .map((sample) => sample.inputThroughTwoFramesMs)
      .sort((a, b) => a - b);
    return {
      samples,
      coldTwoFramesMs: samples[0]?.inputThroughTwoFramesMs ?? null,
      medianTwoFramesMs: sorted[Math.floor(sorted.length / 2)] ?? null,
      maxTwoFramesMs: sorted.at(-1) ?? null,
      selected:
        samples.every((sample) => sample.selected === 'true') &&
        source.getAttribute('aria-pressed') === 'true'
          ? 'true'
          : 'false',
    };
  });
  await info.attach('input-performance', {
    body: JSON.stringify(
      {
        ...measurements,
        cpuThrottle: 4,
        limits:
          'Synthetic keyboard event through two animation frames; desktop CPU emulation, not a physical mobile device or field INP. Eight selection samples per viewport/theme (first cold), each cancelled with Escape; two-frame time includes frame alignment. Storybook overhead excluded: the highlight addon is disabled before navigation, and keydown stops at the document bubble phase so the preview does not forward it to the manager; synchronous time ends at that document listener.',
      },
      null,
      2
    ),
    contentType: 'application/json',
  });
  expect(measurements.selected).toBe('true');
  await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await session.detach();
}
