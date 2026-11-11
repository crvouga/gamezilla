import { afterAll, beforeAll, expect, test } from 'bun:test';
import { runInThisContext } from 'node:vm';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { BunWebviewDriver } from '@pkgs/ui-testing-bun-webview-shared-ts/bun-webview-driver';
import type { BunWebView } from '@pkgs/ui-testing-bun-webview-shared-ts/bun-webview-host';

beforeAll(() => GlobalRegistrator.register());
afterAll(() => GlobalRegistrator.unregister());

const TIMEOUT =
  'timeout waiting for \'[data-testid="space-end"]\' to be actionable';

/** Tap `space-end` while the page reports `boxes` for it and `hit` at its centre. */
async function tapFailure(
  boxes: () => DOMRect,
  hit: (end: Element) => Element
): Promise<string> {
  document.body.innerHTML =
    '<button data-testid="space-end" aria-label="End space">End</button>' +
    '<div data-testid="space-share-sheet"><span aria-label="Invite">Invite</span></div>';
  const end = document.querySelector('button')!;
  const previousFrame = globalThis.requestAnimationFrame;
  const previousHit = document.elementFromPoint;
  end.scrollIntoView = () => {};
  end.getBoundingClientRect = boxes;
  document.elementFromPoint = () => hit(end);
  globalThis.requestAnimationFrame = (callback) => {
    queueMicrotask(() => callback(0));
    return 1;
  };
  const view = {
    evaluate: async (script: string) => runInThisContext(script),
    click: async () => {
      throw new Error(TIMEOUT);
    },
    close: () => {},
  } as unknown as BunWebView;
  try {
    const ui = new BunWebviewDriver({
      view,
      timers: createHarnessClock().timers,
    });
    return await ui
      .get('space-end')
      .tap()
      .then(
        () => 'tapped',
        (error: unknown) => String(error)
      );
  } finally {
    globalThis.requestAnimationFrame = previousFrame;
    document.elementFromPoint = previousHit;
  }
}

// regression: release-journey-tap-blocker-unnamed
test('a tap that never becomes actionable names what covers the element', async () => {
  const message = await tapFailure(
    () => new DOMRect(300, 10, 40, 40),
    () => document.querySelector('span')!
  );
  expect(message).toContain(TIMEOUT);
  expect(message).toContain('still at 300,10,40,40');
  expect(message).toContain('hits <span position= z=> < <div position= z=>');
  expect(message).not.toContain('Invite');
  expect(message).not.toContain('space-share-sheet');
});

test('a tap that never becomes actionable says the element kept moving', async () => {
  let left = 300;
  const message = await tapFailure(
    () => new DOMRect((left += 3), 10, 40, 40),
    (end) => end
  );
  expect(message).toContain(TIMEOUT);
  expect(message).toContain('moving: ');
  expect(message).toContain('hits the element');
});

// regression: browser-buried-back-unnamed-screen
test('a control buried under a stacked screen names both screens', async () => {
  document.body.innerHTML =
    '<section data-screen="settings"><button data-testid="nav-back">Back</button></section>' +
    '<section data-screen="tabs-home"><div><div>Home</div></div></section>';
  const back = document.querySelector('button')!;
  back.scrollIntoView = () => {};
  back.getBoundingClientRect = () => new DOMRect(8, 4, 44, 44);
  const previousFrame = globalThis.requestAnimationFrame;
  const previousHit = document.elementFromPoint;
  document.elementFromPoint = () =>
    document.querySelector('[data-screen="tabs-home"] div div')!;
  globalThis.requestAnimationFrame = (callback) => {
    queueMicrotask(() => callback(0));
    return 1;
  };
  const view = {
    evaluate: async (script: string) => runInThisContext(script),
    click: async () => {
      throw new Error('timeout waiting for \'[data-testid="nav-back"]\'');
    },
    close: () => {},
  } as unknown as BunWebView;
  try {
    const message = await new BunWebviewDriver({
      view,
      timers: createHarnessClock().timers,
    })
      .get('nav-back')
      .tap()
      .then(
        () => 'tapped',
        (error: unknown) => String(error)
      );
    expect(message).toContain('on screen tabs-home');
    expect(message).toContain('the element is on screen settings');
    expect(message).not.toContain('Home');
  } finally {
    globalThis.requestAnimationFrame = previousFrame;
    document.elementFromPoint = previousHit;
  }
});
