import { beforeAll, describe, expect, test } from 'bun:test';

import { evalJson, openView, waitFor, waitForHttp } from '../webview';

const PORT = 4178;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const POPUP_BLOCKED =
  'Popup window was blocked by the browser or failed to open. This can happen in mobile browsers when the window.open() method was invoked too long after a user input was fired.';

beforeAll(async () => {
  await waitForHttp(ORIGIN);
});

const INSTALL_OPEN_CAPTURE = `(function(){
  window.__openedUrl = null;
  window.__fakePopup = { closed: false, close: function(){ this.closed = true; } };
  window.open = function(url){
    window.__openedUrl = String(url);
    return window.__fakePopup;
  };
})()`;

describe('auth oauth harness', () => {
  test('dev oauth popup chooser completes sign-in', async () => {
    const page = openView(ORIGIN);
    try {
      await waitFor(
        page,
        'document.querySelector("[data-testid=harness-sign-in-dev]")'
      );
      await page.evaluate(INSTALL_OPEN_CAPTURE);
      await page.evaluate(
        `document.querySelector("[data-testid=harness-sign-in-dev]").click()`
      );
      await waitFor(page, 'window.__openedUrl != null');
      const launchUrl = await evalJson<string>(page, 'window.__openedUrl');
      const popup = openView(launchUrl);
      try {
        await waitFor(
          popup,
          'document.querySelector("[data-testid=dev-idp-page]")'
        );
        await popup.evaluate(
          `document.querySelector("[data-testid=dev-idp-subject-input]").value = "alice"`
        );
        await popup.evaluate(
          `document.querySelector("[data-testid=dev-idp-continue]").click()`
        );
        await waitFor(popup, 'location.search.indexOf("code=") >= 0', 15_000);
        const code = await evalJson<string | null>(
          popup,
          'new URL(location.href).searchParams.get("code")'
        );
        expect(code != null && code.length > 0).toBe(true);
        await page.evaluate(
          `window.dispatchEvent(new MessageEvent("message", { data: { type: "oauth-complete", code: ${JSON.stringify(code)} } }))`
        );
        await waitFor(
          page,
          'document.querySelector("[data-testid=harness-token]").textContent.length > 0'
        );
        const token = await evalJson<string>(
          page,
          'document.querySelector("[data-testid=harness-token]").textContent'
        );
        expect(token.length).toBeGreaterThan(0);
      } finally {
        popup.close();
      }
    } finally {
      page.close();
    }
  });

  test('closing popup shows cancelled error', async () => {
    const page = openView(ORIGIN);
    try {
      await waitFor(
        page,
        'document.querySelector("[data-testid=harness-sign-in-dev]")'
      );
      await page.evaluate(INSTALL_OPEN_CAPTURE);
      await page.evaluate(
        `document.querySelector("[data-testid=harness-sign-in-dev]").click()`
      );
      await waitFor(page, 'window.__fakePopup != null');
      await page.evaluate(`window.__fakePopup.close()`);
      await waitFor(
        page,
        'document.querySelector("[data-testid=harness-error]").textContent.indexOf("cancelled") >= 0'
      );
    } finally {
      page.close();
    }
  });

  test('blocked popup shows exact browser message', async () => {
    const page = openView(ORIGIN);
    try {
      await waitFor(
        page,
        'document.querySelector("[data-testid=harness-sign-in-dev]")'
      );
      await page.evaluate(`window.open = function(){ return null; }`);
      await page.evaluate(
        `document.querySelector("[data-testid=harness-sign-in-dev]").click()`
      );
      await waitFor(
        page,
        `document.querySelector("[data-testid=harness-error]").textContent === ${JSON.stringify(POPUP_BLOCKED)}`
      );
    } finally {
      page.close();
    }
  });

  test('google launch redirects to Google authorize URL', async () => {
    const page = openView(ORIGIN);
    try {
      await waitFor(
        page,
        'document.querySelector("[data-testid=harness-sign-in-google]")'
      );
      await page.evaluate(INSTALL_OPEN_CAPTURE);
      await page.evaluate(
        `document.querySelector("[data-testid=harness-sign-in-google]").click()`
      );
      await waitFor(page, 'window.__openedUrl != null');
      const url = await evalJson<string>(page, 'window.__openedUrl');
      expect(url).toContain('accounts.google.com');
      expect(url).toContain('client_id=cid');
    } finally {
      page.close();
    }
  });
});
