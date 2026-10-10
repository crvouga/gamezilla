// regression: webview-button-text-empty
/**
 * Every `<button>` has a `value` property (`""` unless set), so the
 * Bun.WebView driver's `text()` read that instead of the label: `expect.text`
 * on a button could never match in a real browser — the avatar "Saved"
 * critical journey failed in production while the Solid DOM driver, which
 * reads `value` only from `<input>` / `<textarea>`, passed. The page scripts
 * run here against a real DOM.
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

function driver(): BunWebviewDriver {
  return new BunWebviewDriver({
    view: domView(),
    timers: createHarnessClock().timers,
  });
}

describe('BunWebviewDriver text of non-field nodes', () => {
  test('a button reads as its label, not its empty value', async () => {
    document.body.innerHTML =
      '<button type="submit" data-testid="save"><span>Saved</span></button>';

    expect(await driver().get('save').text()).toBe('Saved');
  });

  // regression: webview-button-width-lock-text
  test('a button showing feedback reads as that feedback, not also its hidden idle label', async () => {
    // Button feedback keeps the idle label's width with an invisible copy.
    document.body.innerHTML =
      '<button data-testid="save"><div><div class="opacity-0" aria-hidden="true"><span>Save</span></div><div><span>Saved</span></div></div></button>';

    expect(await driver().get('save').text()).toBe('Saved');
  });

  test('an unlabelled icon button reads as its aria-label', async () => {
    document.body.innerHTML =
      '<button data-testid="close" aria-label="Close"><svg></svg></button>';

    expect(await driver().get('close').text()).toBe('Close');
  });
});

test('transparent native radio controls remain actionable through their visible label', async () => {
  // regression: webview-transparent-radio-hidden
  document.body.innerHTML =
    '<label>5+0<input type="radio" data-testid="pace" style="opacity:0"></label>';
  expect(await driver().get('pace').isVisible()).toBe(true);
  document.body.innerHTML =
    '<label style="visibility:hidden">5+0<input type="radio" data-testid="pace" style="opacity:0"></label>';
  expect(await driver().get('pace').isVisible()).toBe(false);
  document.body.innerHTML =
    '<button data-testid="pace" style="opacity:0">Hidden</button>';
  expect(await driver().get('pace').isVisible()).toBe(false);
});
