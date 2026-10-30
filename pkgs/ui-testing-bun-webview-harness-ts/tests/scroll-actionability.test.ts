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

/** A page with a sticky footer, and the browser's nearest / centre scroll geometry. */
async function pressBelowFooter(
  height: number,
  footer: number
): Promise<number> {
  document.body.innerHTML =
    '<button data-testid="find">Find an opponent</button><footer></footer>';
  const button = document.querySelector('button')!;
  const overlay = document.querySelector('footer')!;
  const previousFrame = globalThis.requestAnimationFrame;
  const previousHit = document.elementFromPoint;
  let top = height + 100;
  let clicks = 0;
  Reflect.deleteProperty(window, '__uiTestingPointerCounts');
  button.scrollIntoView = (options) => {
    top =
      typeof options === 'object' && options.block === 'center'
        ? (height - 48) / 2
        : height - 48;
  };
  button.getBoundingClientRect = () => new DOMRect(10, top, 100, 48);
  document.elementFromPoint = (_x, y) =>
    y < height - footer ? button : overlay;
  globalThis.requestAnimationFrame = (callback) => {
    queueMicrotask(() => callback(0));
    return 1;
  };
  const view = {
    evaluate: async (script: string) => runInThisContext(script),
    click: async (x: string | number, y?: number) => {
      if (typeof x === 'string') {
        const target = document.querySelector(x);
        if (target === null) throw new Error(`Click target is missing: ${x}`);
        const box = target.getBoundingClientRect();
        x = box.left + box.width / 2;
        y = box.top + box.height / 2;
      }
      if (y === undefined || document.elementFromPoint(x, y) !== button)
        throw new Error('Find an opponent is covered by the sticky footer');
      clicks++;
      const counts = Reflect.get(window, '__uiTestingPointerCounts');
      counts.down++;
      counts.up++;
      const event = new MouseEvent('click', { bubbles: true, composed: true });
      Object.defineProperty(event, 'isTrusted', { value: true });
      button.dispatchEvent(event);
    },
    close: () => {},
  } as unknown as BunWebView;
  try {
    const ui = new BunWebviewDriver({
      view,
      timers: createHarnessClock().timers,
    });
    await ui.get('find').tap();
    return clicks;
  } finally {
    globalThis.requestAnimationFrame = previousFrame;
    document.elementFromPoint = previousHit;
    Reflect.deleteProperty(window, '__uiTestingPointerCounts');
  }
}

// regression: webview-nearest-scroll-hides-game-action
test('a 48px Find button is pressed above the 80px sticky footer of a 720px page', async () => {
  expect(await pressBelowFooter(720, 80)).toBe(1);
  expect(await pressBelowFooter(480, 32)).toBe(1);
});

test('native button gestures remain actionable across viewport and sticky-footer sizes', async () => {
  await assertProperty(
    'native button scroll actionability',
    fc.asyncProperty(
      fc.integer({ min: 480, max: 1000 }),
      fc.integer({ min: 32, max: 160 }),
      async (height, footer) => {
        expect(await pressBelowFooter(height, footer)).toBe(1);
      }
    )
  );
});
