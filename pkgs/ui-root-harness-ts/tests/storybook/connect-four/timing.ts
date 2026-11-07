// @io-wall-ok — browser-only performance observations, never product time.
import type { Page } from '@playwright/test';

/** Observe actual long tasks over the measured sequence, excluding startup. */
export async function startTiming(page: Page): Promise<void> {
  await page.evaluate(() => {
    const root = document.querySelector('#storybook-root');
    if (!root) throw new Error('Missing canvas');
    root.setAttribute('data-long-tasks', '[]');
    const observer = new PerformanceObserver((list) => {
      const durations = JSON.parse(
        root.getAttribute('data-long-tasks') ?? '[]'
      );
      durations.push(...list.getEntries().map((entry) => entry.duration));
      root.setAttribute('data-long-tasks', JSON.stringify(durations));
    });
    observer.observe({ type: 'longtask' });
    root.addEventListener('stop-timing', () => observer.disconnect(), {
      once: true,
    });
  });
}

export async function finishTiming(page: Page): Promise<number[]> {
  return await page.locator('#storybook-root').evaluate((root) => {
    root.dispatchEvent(new Event('stop-timing'));
    return JSON.parse(root.getAttribute('data-long-tasks') ?? '[]') as number[];
  });
}
