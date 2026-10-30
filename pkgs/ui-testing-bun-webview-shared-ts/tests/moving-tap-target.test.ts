import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { BunWebviewDriver } from '@pkgs/ui-testing-bun-webview-shared-ts/bun-webview-driver';
import type { BunWebView } from '@pkgs/ui-testing-bun-webview-shared-ts/bun-webview-host';
import { Window } from 'happy-dom';

test('a replaced unique attempt button remains the logical tap target', async () => {
  // regression: browser-tap-detached-unique-marker
  const window = new Window();
  const markup =
    '<button data-testid="content-start-attempt">Start a new attempt</button>';
  window.document.body.innerHTML = markup;
  const prepare = () => {
    const target = window.document.querySelector('button')!;
    target.scrollIntoView = () => undefined;
    target.getBoundingClientRect = () => new window.DOMRect(0, 100, 100, 40);
    window.document.elementFromPoint = () => target;
  };
  prepare();
  Object.defineProperty(window, 'requestAnimationFrame', {
    value: (callback: (timestamp: number) => void) =>
      queueMicrotask(() => callback(0)),
  });
  let clicks = 0;
  const view: BunWebView = {
    navigate: async () => undefined,
    close: () => undefined,
    press: async () => undefined,
    screenshot: async () => new Uint8Array(),
    evaluate: async (script) => {
      if (script.includes('__uiTestingPointerCounts'))
        return [clicks, clicks, clicks, 1, true];
      if (
        !script.includes('document.elementFromPoint') &&
        script.includes('getComputedStyle')
      )
        return true;
      const result = await window.eval(script);
      if (script.includes('document.elementFromPoint')) {
        window.document.body.innerHTML = markup;
        prepare();
      }
      return result;
    },
    click: async (selector) => {
      if (
        typeof selector !== 'string' ||
        window.document.querySelector(selector) === null
      )
        throw new Error(
          'the marked button was replaced before native dispatch'
        );
      clicks += 1;
    },
  };
  try {
    await new BunWebviewDriver({ view, timers: createHarnessClock().timers })
      .get('content-start-attempt')
      .tap();
    expect(clicks).toBe(1);
  } finally {
    await window.happyDOM.close();
  }
});

test('a late offline notice cannot redirect a draft creation tap', async () => {
  // regression: browser-tap-stale-target-coordinates
  const window = new Window();
  window.document.body.innerHTML =
    '<button data-testid="content-create-pack" style="display:none">Covered screen</button><button id="target" data-testid="content-create-pack">Create pack</button><button id="other">Other action</button>';
  const target = window.document.querySelector('#target')!;
  const other = window.document.querySelector('#other')!;
  let top = 100;
  target.scrollIntoView = () => undefined;
  target.getBoundingClientRect = () => new window.DOMRect(0, top, 100, 40);
  Object.defineProperty(window, 'requestAnimationFrame', {
    value: (callback: (timestamp: number) => void) =>
      queueMicrotask(() => callback(0)),
  });
  window.document.elementFromPoint = (_x, y) =>
    y >= top && y < top + 40 ? target : other;
  let created = 0;
  let unintended = 0;
  let clicks = 0;
  const view: BunWebView = {
    navigate: async () => undefined,
    close: () => undefined,
    press: async () => undefined,
    screenshot: async () => new Uint8Array(),
    evaluate: async (script) => {
      if (script.includes('__uiTestingPointerCounts'))
        return [clicks, clicks, clicks, 1, true];
      if (
        !script.includes('document.elementFromPoint') &&
        script.includes('getComputedStyle')
      )
        return true;
      const result = await window.eval(script);
      if (script.includes('document.elementFromPoint')) top += 160;
      return result;
    },
    click: async (selectorOrX: string | number, y?: number) => {
      const hit =
        typeof selectorOrX === 'string'
          ? window.document.querySelector(selectorOrX)
          : window.document.elementFromPoint(selectorOrX, y!);
      if (hit === target) created += 1;
      else unintended += 1;
      clicks += 1;
    },
  };
  try {
    await new BunWebviewDriver({ view, timers: createHarnessClock().timers })
      .get('content-create-pack')
      .tap();
    expect({ created, unintended, clicks }).toEqual({
      created: 1,
      unintended: 0,
      clicks: 1,
    });
    expect(
      window.document.querySelector('[data-ui-testing-press-target]')
    ).toBeNull();
  } finally {
    await window.happyDOM.close();
  }
});
