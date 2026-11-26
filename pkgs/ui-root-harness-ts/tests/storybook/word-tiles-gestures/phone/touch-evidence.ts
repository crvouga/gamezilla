// @io-wall-ok — retain the native input path for a hosted phone gesture.
import type { Page, TestInfo } from '@playwright/test';
import { retainEvidence } from '../../word-tiles/retained-evidence';

export async function observeTouches(page: Page) {
  await page.addInitScript(() => {
    const events: object[] = [];
    Object.assign(window, { wordTileTouches: events });
    const record = (event: Event) => {
      if (!event.isTrusted || !(event.target instanceof Element)) return;
      const control = event.target.closest('button, [data-testid]');
      events.push({
        type: event.type,
        phase: event.eventPhase,
        time: event.timeStamp,
        target:
          control?.getAttribute('data-testid') ??
          control?.getAttribute('aria-label'),
        pointer: event instanceof PointerEvent ? event.pointerId : undefined,
        primary: event instanceof PointerEvent ? event.isPrimary : undefined,
        prevented: event.defaultPrevented,
      });
    };
    for (const type of [
      'pointerdown',
      'pointerup',
      'pointercancel',
      'lostpointercapture',
      'touchstart',
      'touchend',
      'touchcancel',
      'click',
    ])
      window.addEventListener(type, record, true);
    window.addEventListener('click', record);
  });
}

export async function saveTouches(page: Page, info: TestInfo) {
  const body = await page.evaluate(() => {
    const events: unknown = Reflect.get(window, 'wordTileTouches');
    return JSON.stringify(events ?? []);
  });
  if (info.status !== info.expectedStatus)
    process.stdout.write(`[word-tiles-touch] ${body}\n`);
  await retainEvidence(info, 'touch-events.json', {
    body,
    contentType: 'application/json',
  });
}
