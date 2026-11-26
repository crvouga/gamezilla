import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { BunWebView } from '@pkgs/ui-testing-bun-webview-shared-ts/bun-webview-host';
import { BunWebviewPopups } from '@pkgs/ui-testing-bun-webview-shared-ts/bun-webview-popups';

function view(evaluate: (script: string) => Promise<unknown>) {
  let closed = 0;
  const value: BunWebView & { readonly url: string } = {
    url: 'http://127.0.0.1:33334/oauth/authorize',
    navigate: () => Promise.resolve(),
    click: () => Promise.resolve(),
    press: () => Promise.resolve(),
    evaluate,
    screenshot: () => Promise.resolve(new Uint8Array()),
    close: () => {
      closed += 1;
    },
  };
  return { value, closed: () => closed };
}

test('a popup that stopped answering is forgotten instead of hanging the call that looks in it', async () => {
  // regression: silent-popup-hangs-opener-call
  const time = createHarnessClock();
  const opener = view((script) =>
    Promise.resolve(
      script.includes('JSON.stringify')
        ? JSON.stringify([
            {
              id: 1,
              url: 'http://127.0.0.1:33334/oauth/authorize',
              name: 'auth',
              closed: false,
              taken: false,
            },
          ])
        : true
    )
  );
  // Its document went away: nothing it is asked ever settles.
  const popup = view(() => new Promise<never>(() => {}));
  const popups = new BunWebviewPopups(
    time.timers,
    opener.value,
    () => Promise.resolve(),
    { createView: () => popup.value }
  );
  await popups.sync();

  const found = popups.showing('[data-testid="auth-method-google"]');
  time.clock.advance(10_000);

  expect(await found).toBeNull();
  expect(popup.closed()).toBe(1);
  // Forgotten: the next look goes straight to the opener.
  expect(await popups.showing('[data-testid="auth-method-google"]')).toBeNull();
});

test('a popup that answers keeps the calls whose element it shows', async () => {
  const time = createHarnessClock();
  const opener = view((script) =>
    Promise.resolve(
      script.includes('JSON.stringify')
        ? JSON.stringify([
            {
              id: 1,
              url: 'http://idp/x',
              name: '',
              closed: false,
              taken: false,
            },
          ])
        : true
    )
  );
  const popup = view(() => Promise.resolve(true));
  const popups = new BunWebviewPopups(
    time.timers,
    opener.value,
    () => Promise.resolve(),
    { createView: () => popup.value }
  );
  await popups.sync();
  expect(await popups.showing('[data-testid="idp-approve"]')).toBe(popup.value);
  expect(popup.closed()).toBe(0);
});
