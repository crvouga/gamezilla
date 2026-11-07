// @io-wall-ok — automated browser evidence observes browser timing and writes test artifacts.
import { expect, type Page, type TestInfo } from '@playwright/test';
import axe from 'axe-core';

export async function openChessStory(page: Page, id: string, theme: string) {
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort()
  );
  await page.goto(
    `/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`
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
    return report.violations;
  });
  await info.attach(`${name}-accessibility`, {
    body: JSON.stringify(result, null, 2),
    contentType: 'application/json',
  });
  expect(
    result.filter((v) => v.impact === 'serious' || v.impact === 'critical')
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
    const longTasks: number[] = [];
    const observer = new PerformanceObserver((list) => {
      longTasks.push(...list.getEntries().map((entry) => entry.duration));
    });
    observer.observe({ type: 'longtask', buffered: false });
    const source = document.querySelector<HTMLElement>('[data-square="e2"]');
    if (!source) throw new Error('Missing e2');
    source.focus();
    const start = performance.now();
    source.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      })
    );
    const synchronousMs = performance.now() - start;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      })
    );
    const inputThroughTwoFramesMs = performance.now() - start;
    longTasks.push(...observer.takeRecords().map((entry) => entry.duration));
    observer.disconnect();
    return {
      synchronousMs,
      inputThroughTwoFramesMs,
      longTasks,
      selected: source.getAttribute('aria-pressed'),
    };
  });
  await info.attach('input-performance', {
    body: JSON.stringify(
      {
        ...measurements,
        cpuThrottle: 4,
        limits:
          'Synthetic keyboard event through two animation frames; desktop CPU emulation, not a physical mobile device or field INP. One cold selection sample per viewport/theme.',
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
