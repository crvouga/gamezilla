import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { BunWebviewDriver } from '@pkgs/ui-testing-bun-webview-shared-ts/bun-webview-driver';
import type { BunWebView } from '@pkgs/ui-testing-bun-webview-shared-ts/bun-webview-host';
import {
  diagnosePress,
  pressDiagnosisScript,
} from '@pkgs/ui-testing-bun-webview-shared-ts/press-diagnosis';
import { Window } from 'happy-dom';

test('a selected attempt button timeout retains its cause and bounded geometry evidence', async () => {
  // regression: browser-selected-tap-missing-actionability-evidence
  const window = new Window();
  window.document.body.innerHTML =
    '<button data-testid="content-start-attempt">Start a new attempt</button><aside aria-label="secret-token" class="secret-token" data-testid="secret-token">secret-token</aside>';
  const target = window.document.querySelector('button')!;
  const overlay = window.document.querySelector('aside')!;
  let failed = false;
  target.scrollIntoView = () => undefined;
  target.getBoundingClientRect = () =>
    new window.DOMRect(0, failed ? 900 : 100, 100, 40);
  window.document.elementFromPoint = () => (failed ? overlay : target);
  Object.defineProperty(window, 'requestAnimationFrame', {
    value: (callback: (timestamp: number) => void) =>
      queueMicrotask(() => callback(0)),
  });
  const original = new Error(
    'timeout waiting for \'[data-testid="content-start-attempt"]\' to be actionable'
  );
  let clicks = 0;
  const view = {
    evaluate: async (script: string) => {
      if (script.includes('__uiTestingPointerCounts'))
        return [0, 0, 0, 1, true];
      return window.eval(script);
    },
    click: async () => {
      clicks++;
      failed = true;
      throw original;
    },
  } as unknown as BunWebView;
  try {
    const error = await new BunWebviewDriver({
      view,
      timers: createHarnessClock().timers,
    })
      .get('content-start-attempt')
      .tap()
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).cause).toBe(original);
    expect((error as Error).message).toContain(original.message);
    expect((error as Error).message).toContain('still at 0,900,100,40');
    expect((error as Error).message).toContain('hits <aside');
    expect((error as Error).message).toContain('disabled=false');
    expect((error as Error).message).not.toContain('secret-token');
    expect((error as Error).message.length).toBeLessThan(1700);
    expect(clicks).toBe(1);
  } finally {
    await window.happyDOM.close();
  }
});

test('diagnosis has a virtual one-second deadline even when browser frames stop', async () => {
  const { clock, timers } = createHarnessClock();
  const result = diagnosePress(
    { evaluate: () => new Promise(() => undefined) },
    '[data-testid="content-start-attempt"]',
    timers
  );
  clock.advance(1000);
  expect(await result).toBe('no diagnosis (deadline)');
  expect(clock.pendingOneShotCount()).toBe(0);
});

test('diagnosis failures disclose no raw browser exception and release the timer', async () => {
  const { clock, timers } = createHarnessClock();
  expect(
    await diagnosePress(
      {
        evaluate: async () => {
          throw new Error('secret-token');
        },
      },
      '[data-testid="content-start-attempt"]',
      timers
    )
  ).toBe('no diagnosis (unavailable)');
  expect(clock.pendingOneShotCount()).toBe(0);
});

test('diagnosis caps the browser response and releases its deadline', async () => {
  const { clock, timers } = createHarnessClock();
  const result = await diagnosePress(
    { evaluate: async () => 'x'.repeat(3000) },
    '[data-testid="content-start-attempt"]',
    timers
  );
  expect(result.length).toBe(1500);
  expect(clock.pendingOneShotCount()).toBe(0);
});

test('diagnosis preserves subpixel movement that prevents native actionability', async () => {
  const window = new Window();
  window.document.body.innerHTML = '<button data-testid="attempt"></button>';
  const target = window.document.querySelector('button')!;
  let top = 100;
  target.getBoundingClientRect = () => new window.DOMRect(0, top, 100, 40);
  window.document.elementFromPoint = () => target;
  Object.defineProperty(window, 'requestAnimationFrame', {
    value: (callback: (timestamp: number) => void) => {
      top += 0.125;
      callback(0);
    },
  });
  try {
    const result = await window.eval(
      pressDiagnosisScript('[data-testid="attempt"]')
    );
    expect(result).toContain('moving: 0,100.125,100,40 -> 0,100.25,100,40');
  } finally {
    await window.happyDOM.close();
  }
});
