// regression: webview-input-wrapper-noop
/**
 * `@pkgs/ui` `TextInput` puts its test id on a wrapper `<div>`, not on the
 * `<input>`. The Bun.WebView driver only typed into a node that held a
 * `value`, so `input` / `clear` on a TextInput were silent no-ops in a real
 * browser (the Solid DOM driver resolved the nested field and hid it). The
 * page scripts run here against a real DOM.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { runInThisContext } from 'node:vm';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { BunWebviewDriver } from '@pkgs/ui-testing-bun-webview-shared/bun-webview-driver';
import type { BunWebView } from '@pkgs/ui-testing-bun-webview-shared/bun-webview-host';

beforeAll(() => {
  GlobalRegistrator.register();
});

afterAll(async () => {
  await GlobalRegistrator.unregister();
});

/** A view whose page is this process's DOM: scripts run as the page would. */
function domView(): BunWebView {
  return {
    navigate: () => Promise.resolve(),
    click: () => Promise.resolve(),
    press: () => Promise.resolve(),
    // Global scope, where the registered `document` lives.
    evaluate: (script: string) => Promise.resolve(runInThisContext(script)),
    screenshot: () => Promise.resolve(new Uint8Array()),
    close: () => undefined,
  } as unknown as BunWebView;
}

describe('BunWebviewDriver text fields', () => {
  test('input / clear / text reach the field inside a TextInput wrapper', async () => {
    document.body.innerHTML =
      '<div data-testid="seed"><label>Seed</label><input value="old-seed" /></div>';
    const field = document.querySelector('input') as HTMLInputElement;
    const typed: string[] = [];
    field.addEventListener('input', () => typed.push(field.value));
    const driver = new BunWebviewDriver({
      view: domView(),
      timers: createHarnessClock().timers,
    });

    await driver.get('seed').clear();
    await driver.get('seed').input('new-seed');

    expect(field.value).toBe('new-seed');
    expect(typed).toEqual(['', 'new-seed']);
    expect(await driver.get('seed').text()).toBe('new-seed');
  });
});
