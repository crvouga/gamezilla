// @io-wall-ok — browser measurement adapter for automated recordings.
import type { Page } from '@playwright/test';

type TimingSample = {
  type: string;
  name: string;
  startTime: number;
  duration: number;
  interactionId: number | null;
  processingStart: number | null;
  processingEnd: number | null;
  target: string | null;
};
type Capture = {
  samples: TimingSample[];
  observers: PerformanceObserver[];
  append: (entries: PerformanceEntry[]) => void;
};

export async function startTimingCapture(page: Page) {
  await page.evaluate(() => {
    const samples: TimingSample[] = [];
    const append = (entries: PerformanceEntry[]) => {
      for (const entry of entries) {
        const event = entry as PerformanceEntry &
          Partial<PerformanceEventTiming>;
        samples.push({
          type: entry.entryType,
          name: entry.name,
          startTime: entry.startTime,
          duration: entry.duration,
          interactionId: event.interactionId ?? null,
          processingStart: event.processingStart ?? null,
          processingEnd: event.processingEnd ?? null,
          target:
            event.target instanceof HTMLElement
              ? (event.target.dataset['testid'] ?? null)
              : null,
        });
      }
    };
    const observers = ['event', 'longtask'].map((type) => {
      const observer = new PerformanceObserver((list) =>
        append(list.getEntries())
      );
      const options: PerformanceObserverInit & { durationThreshold: number } = {
        type,
        buffered: false,
        durationThreshold: 16,
      };
      observer.observe(options);
      return observer;
    });
    Object.assign(window, {
      battleshipMetrics: { samples, observers, append },
    });
  });
}

export async function finishTimingCapture(page: Page): Promise<TimingSample[]> {
  return page.evaluate(() => {
    const capture = (window as unknown as { battleshipMetrics: Capture })
      .battleshipMetrics;
    for (const observer of capture.observers) {
      capture.append(observer.takeRecords());
      observer.disconnect();
    }
    return capture.samples;
  });
}
