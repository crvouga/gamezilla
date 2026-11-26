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

async function tap(reject: boolean, navigate: boolean) {
  document.body.innerHTML =
    '<button data-testid="attempt" hidden></button><button data-testid="attempt">Start</button>';
  const target = document.querySelectorAll('button')[1]!;
  target.scrollIntoView = () => {};
  target.getBoundingClientRect = () => new DOMRect(0, 100, 100, 40);
  const hit = document.elementFromPoint;
  document.elementFromPoint = () => target;
  const request = globalThis.requestAnimationFrame;
  const cancel = globalThis.cancelAnimationFrame;
  const frames = new Set<number>();
  let sequence = 0;
  globalThis.requestAnimationFrame = (callback) => {
    const frame = ++sequence;
    frames.add(frame);
    queueMicrotask(() => {
      if (frames.delete(frame)) callback(0);
    });
    return frame;
  };
  globalThis.cancelAnimationFrame = (id) => {
    frames.delete(id);
  };

  let navigated = false;
  const failure = new Error('native click failed');
  const view = {
    evaluate: async (script: string) => {
      const value = await runInThisContext(script);
      // A navigation gives the acknowledgement a new document time origin.
      if (navigated && Array.isArray(value)) value[3] = 1;
      return value;
    },
    click: async (selector: string) => {
      expect(frames.size).toBe(1);
      expect(document.querySelector(selector)).toBe(target);
      if (navigate) {
        window.dispatchEvent(new Event('pagehide'));
        navigated = true;
      }
      if (reject) throw failure;
      if (!navigate) {
        const event = new MouseEvent('click', {
          bubbles: true,
          composed: true,
        });
        Object.defineProperty(event, 'isTrusted', { value: true });
        target.dispatchEvent(event);
      }
    },
  } as unknown as BunWebView;
  try {
    const error = await new BunWebviewDriver({
      view,
      timers: createHarnessClock().timers,
    })
      .get('attempt')
      .tap()
      .then(
        () => null,
        (caught: Error) => caught
      );
    if (reject) expect(error?.cause).toBe(failure);
    else expect(error).toBeNull();
    expect(frames.size).toBe(0);
    expect(target.hasAttribute('data-ui-testing-press-target')).toBe(false);
    expect(Reflect.has(window, '__uiTestingPressVisibility')).toBe(false);
  } finally {
    window.dispatchEvent(new Event('pagehide'));
    globalThis.requestAnimationFrame = request;
    globalThis.cancelAnimationFrame = cancel;
    document.elementFromPoint = hit;
  }
}

test('a native tap releases its frame and marker after success, rejection or navigation', async () => {
  await assertProperty(
    'press visibility cleanup',
    fc.asyncProperty(fc.boolean(), fc.boolean(), tap)
  );
});
