import { afterAll, beforeAll, expect, test } from 'bun:test';
import { runInThisContext } from 'node:vm';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { BunWebviewDriver } from '@pkgs/ui-testing-bun-webview-shared-ts/bun-webview-driver';
import type { BunWebView } from '@pkgs/ui-testing-bun-webview-shared-ts/bun-webview-host';
import fc from 'fast-check';

beforeAll(() => GlobalRegistrator.register());
afterAll(() => GlobalRegistrator.unregister());

async function lateShift(args: {
  height: number;
  top: number;
  reject: boolean;
  bar: number;
  cover?: boolean;
}) {
  document.body.innerHTML =
    '<button data-testid="content-start-attempt">Start a new attempt</button><footer></footer>';
  const button = document.querySelector('button')!;
  const overlay = document.querySelector('footer')!;
  const originals = {
    frame: globalThis.requestAnimationFrame,
    cancel: globalThis.cancelAnimationFrame,
    hit: document.elementFromPoint,
    height: globalThis.innerHeight,
    width: globalThis.innerWidth,
  };
  const pending = new Set<number>();
  let sequence = 0;
  let top = 100;
  let scrolls = 0;
  let clicks = 0;
  let actionable = false;
  let covered = false;
  Reflect.deleteProperty(window, '__uiTestingPointerCounts');
  Object.defineProperty(globalThis, 'innerHeight', {
    configurable: true,
    value: args.height,
  });
  Object.defineProperty(globalThis, 'innerWidth', {
    configurable: true,
    value: 500,
  });
  globalThis.requestAnimationFrame = (callback) => {
    const id = ++sequence;
    pending.add(id);
    queueMicrotask(() => {
      if (pending.delete(id)) callback(0);
    });
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    pending.delete(id);
  };
  button.scrollIntoView = () => {
    scrolls++;
    top = (args.height - 44) / 2;
  };
  button.getBoundingClientRect = () => new DOMRect(16, top, 167.71875, 44);
  document.elementFromPoint = (_x, y) =>
    y < 0 || y >= args.height
      ? null
      : covered || y < args.bar || y > args.height - args.bar
        ? overlay
        : button;
  const view = {
    evaluate: async (script: string) => runInThisContext(script),
    click: async () => {
      clicks++;
      // The late offline banner changes layout after the locator already scrolled.
      top = args.top;
      covered = args.cover === true;
      let previousTop: number | null = null;
      for (let frame = 0; frame < 8; frame++) {
        await new Promise(requestAnimationFrame);
        const y = top + 22;
        const stable = previousTop === top;
        previousTop = top;
        if (
          stable &&
          y >= 0 &&
          y < args.height &&
          document.elementFromPoint(100, y) === button
        ) {
          actionable = true;
          if (args.reject) throw new Error('native dispatch rejected');
          const event = new MouseEvent('click', {
            bubbles: true,
            composed: true,
          });
          Object.defineProperty(event, 'isTrusted', { value: true });
          button.dispatchEvent(event);
          return;
        }
      }
      throw new Error('native actionability deadline');
    },
  } as unknown as BunWebView;
  try {
    const failure = await new BunWebviewDriver({
      view,
      timers: createHarnessClock().timers,
    })
      .get('content-start-attempt')
      .tap()
      .then(
        () => null,
        (error: unknown) => error
      );
    return { clicks, scrolls, actionable, failure, pending: pending.size };
  } finally {
    globalThis.requestAnimationFrame = originals.frame;
    globalThis.cancelAnimationFrame = originals.cancel;
    document.elementFromPoint = originals.hit;
    Object.defineProperty(globalThis, 'innerHeight', {
      configurable: true,
      value: originals.height,
    });
    Object.defineProperty(globalThis, 'innerWidth', {
      configurable: true,
      value: originals.width,
    });
    Reflect.deleteProperty(window, '__uiTestingPointerCounts');
  }
}

test('the offline Numberlink start button remains reachable after a late layout shift', async () => {
  // regression: browser-tap-late-layout-shift-outside-viewport
  const result = await lateShift({
    height: 757,
    top: 753,
    reject: false,
    bar: 176,
  });
  expect(result).toEqual({
    clicks: 1,
    scrolls: 2,
    actionable: true,
    failure: null,
    pending: 0,
  });
});

test('late shifts preserve one native click and release tracking on success or rejection', async () => {
  await assertProperty(
    'late native selector scroll',
    fc.asyncProperty(
      fc.integer({ min: 480, max: 1000 }),
      fc.integer({ min: 1, max: 500 }),
      fc.boolean(),
      fc.boolean(),
      async (height, distance, above, reject) => {
        const result = await lateShift({
          height,
          top: above ? -44 - distance : height + distance,
          reject,
          bar: 80,
        });
        expect(result.clicks).toBe(1);
        expect(result.scrolls).toBe(2);
        expect(result.actionable).toBe(true);
        expect(result.pending).toBe(0);
        if (reject)
          expect(String(result.failure)).toContain('native dispatch rejected');
        else expect(result.failure).toBeNull();
      }
    )
  );
});

test('a target already visible after layout settles is not scrolled again', async () => {
  expect(
    await lateShift({ height: 757, top: 300, reject: false, bar: 80 })
  ).toEqual({
    clicks: 1,
    scrolls: 1,
    actionable: true,
    failure: null,
    pending: 0,
  });
});

test('a full-viewport overlay appearing after location remains a native hit-test rejection', async () => {
  const result = await lateShift({
    height: 757,
    top: 700,
    reject: false,
    bar: 80,
    cover: true,
  });
  expect(result.clicks).toBe(1);
  expect(result.actionable).toBe(false);
  expect(String(result.failure)).toContain('native actionability deadline');
  expect(result.pending).toBe(0);
});
