import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { BunWebviewDriver } from '@pkgs/ui-testing-bun-webview-shared-ts/bun-webview-driver';
import type { BunWebView } from '@pkgs/ui-testing-bun-webview-shared-ts/bun-webview-host';
import { Window } from 'happy-dom';

test('range input selects an absolute value while text input appends', async () => {
  // regression: range-driver-appends-position
  const window = new Window({ settings: { enableJavaScriptEvaluation: true } });
  window.document.body.innerHTML = `
    <input data-testid="position" type="range" min="0" max="1000" value="500">
    <input data-testid="email" type="text">`;
  const position = window.document.querySelector('input')!;
  const inputs: string[] = [];
  position.addEventListener('input', () => inputs.push(position.value));
  const view: BunWebView = {
    navigate: async () => undefined,
    click: async () => undefined,
    press: async () => undefined,
    evaluate: async (script) => window.eval(script),
    screenshot: async () => new Uint8Array(),
    close: () => undefined,
  };
  const driver = new BunWebviewDriver({
    view,
    timers: createHarnessClock().timers,
  });
  try {
    expect(await driver.get('position').text()).toBe('500');
    await driver.get('position').input('200');
    await driver.get('position').input('800');
    expect(inputs).toEqual(['200', '800']);
    await driver.get('email').input('alice');
    await driver.get('email').input('@example.com');
    expect(await driver.get('email').text()).toBe('alice@example.com');
  } finally {
    await driver.close();
    await window.happyDOM.close();
  }
});
