import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { BunWebviewDriver } from '@pkgs/ui-testing-bun-webview-shared-ts/bun-webview-driver';
import { Window } from 'happy-dom';

// regression: pong-wide-court-releases-input-before-the-simulation-tick
test('a browser court keeps an arrow pressed between driver calls', async () => {
  const window = new Window({ settings: { enableJavaScriptEvaluation: true } });
  const court = window.document.createElement('button');
  court.setAttribute('data-testid', 'multiplayer-board');
  window.document.body.append(court);
  const held = new Set<string>();
  court.addEventListener('keydown', (event) => {
    if (event instanceof window.KeyboardEvent) held.add(event.key);
  });
  court.addEventListener('keyup', (event) => {
    if (event instanceof window.KeyboardEvent) held.delete(event.key);
  });
  const driver = new BunWebviewDriver({
    view: {
      navigate: async () => undefined,
      click: async () => undefined,
      press: async () => undefined,
      evaluate: async (script) => window.eval(script),
      screenshot: async () => new Uint8Array(),
      close: () => undefined,
    },
    timers: createHarnessClock().timers,
  });
  try {
    const board = driver.get('multiplayer-board');
    await board.key('arrowDown', 'keydown');
    expect(window.document.activeElement).toBe(court);
    expect([...held]).toEqual(['ArrowDown']);
    await board.key('arrowDown', 'keyup');
    expect(held.size).toBe(0);
  } finally {
    await driver.close();
    await window.happyDOM.close();
  }
});
