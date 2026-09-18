import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import { evalJson, openView, waitFor, waitForHttp } from '../webview';

const PORT = 4178;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const POPUP_BLOCKED =
  'Popup window was blocked by the browser or failed to open. This can happen in mobile browsers when the window.open() method was invoked too long after a user input was fired.';

beforeAll(async () => {
  await waitForHttp(ORIGIN);
});

/**
 * Every scenario signs in as the same account, and the provider remembers the
 * approval (as Google does) — so the *second* flow would find the scopes
 * already granted and skip the consent screen, turning an ordering artifact
 * into a failure. Wipe runtime state so each scenario starts with consent
 * pending. `/__idp/*` is the provider's test-only control plane.
 */
async function resetIdp(): Promise<void> {
  const config = await fetch(`${ORIGIN}/__harness/config`);
  const { idpOrigin } = (await config.json()) as {
    readonly idpOrigin: string;
  };
  const reset = await fetch(`${idpOrigin}/__idp/reset`, { method: 'POST' });
  if (!reset.ok) {
    throw new Error(`idp reset failed: ${reset.status}`);
  }
}

beforeEach(async () => {
  await resetIdp();
});

const INSTALL_OPEN_CAPTURE = `(function(){
  window.__openedUrl = null;
  window.__fakePopup = { closed: false, close: function(){ this.closed = true; } };
  window.open = function(url){
    window.__openedUrl = String(url);
    return window.__fakePopup;
  };
})()`;

const SIGN_IN = '[data-testid=harness-sign-in-google]';

async function startSignIn(page: ReturnType<typeof openView>): Promise<string> {
  await waitFor(page, `document.querySelector("${SIGN_IN}")`);
  await page.evaluate(INSTALL_OPEN_CAPTURE);
  await page.evaluate(`document.querySelector("${SIGN_IN}").click()`);
  await waitFor(page, 'window.__openedUrl != null');
  return await evalJson<string>(page, 'window.__openedUrl');
}

describe('auth oauth harness', () => {
  test('the real Google flow completes against the simulated provider', async () => {
    const page = openView(ORIGIN);
    try {
      const popup = openView(await startSignIn(page));
      try {
        await waitFor(
          popup,
          'document.querySelector("[data-testid=idp-identifier-page]")'
        );
        await popup.evaluate(
          `document.querySelector("[data-testid=idp-identifier-email]").value = "alice@gmail.com"`
        );
        await popup.evaluate(
          `document.querySelector("[data-testid=idp-identifier-next]").click()`
        );
        await waitFor(
          popup,
          'document.querySelector("[data-testid=idp-password-input]")',
          15_000
        );
        await popup.evaluate(
          `document.querySelector("[data-testid=idp-password-input]").value = "password"`
        );
        await popup.evaluate(
          `document.querySelector("[data-testid=idp-password-next]").click()`
        );
        await waitFor(
          popup,
          'document.querySelector("[data-testid=idp-consent-allow]")',
          15_000
        );
        await popup.evaluate(
          `document.querySelector("[data-testid=idp-consent-allow]").click()`
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

  test('cancelling on the provider returns the app to an error', async () => {
    const page = openView(ORIGIN);
    try {
      const popup = openView(await startSignIn(page));
      try {
        await waitFor(
          popup,
          'document.querySelector("[data-testid=idp-identifier-page]")'
        );
        await popup.evaluate(
          `document.querySelector("[data-testid=idp-identifier-email]").value = "alice@gmail.com"`
        );
        await popup.evaluate(
          `document.querySelector("[data-testid=idp-identifier-next]").click()`
        );
        await waitFor(
          popup,
          'document.querySelector("[data-testid=idp-password-input]")',
          15_000
        );
        await popup.evaluate(
          `document.querySelector("[data-testid=idp-password-input]").value = "password"`
        );
        await popup.evaluate(
          `document.querySelector("[data-testid=idp-password-next]").click()`
        );
        await waitFor(
          popup,
          'document.querySelector("[data-testid=idp-consent-deny]")',
          15_000
        );
        await popup.evaluate(
          `document.querySelector("[data-testid=idp-consent-deny]").click()`
        );
        await waitFor(
          popup,
          'location.search.indexOf("error=access_denied") >= 0',
          15_000
        );
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
      await waitFor(page, `document.querySelector("${SIGN_IN}")`);
      await page.evaluate(INSTALL_OPEN_CAPTURE);
      await page.evaluate(`document.querySelector("${SIGN_IN}").click()`);
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
      await waitFor(page, `document.querySelector("${SIGN_IN}")`);
      await page.evaluate(`window.open = function(){ return null; }`);
      await page.evaluate(`document.querySelector("${SIGN_IN}").click()`);
      await waitFor(
        page,
        `document.querySelector("[data-testid=harness-error]").textContent === ${JSON.stringify(POPUP_BLOCKED)}`
      );
    } finally {
      page.close();
    }
  });
});
