import { expect, test } from 'bun:test';
import { globalActionMenuAlwaysVisible } from '@libs/harness-ts/define-product-system';
import type { ProductHarness } from '@libs/harness-ts/harness';
import type { ProductHttp } from '@libs/harness-ts/ports';
import { atConfiguredGoogleHandoff } from '@libs/harness-ts/provider-handoff';

const http: ProductHttp = {
  kind: 'stack',
  origin: 'http://127.0.0.1:43000',
  idpOrigins: {
    google: 'http://127.0.0.1:44471',
    apple: 'http://127.0.0.1:44472',
  },
  accountTag: 'monitor-regression',
};
const authorize =
  'http://127.0.0.1:44471/o/oauth2/v2/auth?response_type=code&state=literal&redirect_uri=http%3A%2F%2F127.0.0.1%3A43000%2Fapi%2Fauth%2Fcallback%2Fgoogle';
const browser = (url: string) => ({
  currentUrl: async () => url,
  waitForNavigation: async () => url,
});

// regression: global-menu-monitor-rejects-google-handoff
// The retained native HTML pins provider port 44471; API port/state are fixture values.
test('only the configured valid Google handoff exempts app chrome', async () => {
  expect(await atConfiguredGoogleHandoff(browser(authorize), http)).toBe(true);
  expect(
    await atConfiguredGoogleHandoff(
      browser(
        `http://127.0.0.1:44471/chooser?continue=${encodeURIComponent(authorize)}`
      ),
      http
    )
  ).toBe(true);
});

test('unexpected external locations and incomplete authorization keep chrome required', async () => {
  for (const url of [
    'https://unexpected.invalid/',
    authorize.replace(':44471', ':44472'),
    authorize.replace('state=literal', 'state='),
    authorize.replace('response_type=code', 'response_type=token'),
    authorize.replace('43000', '43001'),
    authorize.replace('http://', 'http://user:secret@'),
    'http://127.0.0.1:44471/',
    `https://unexpected.invalid/?continue=${encodeURIComponent(authorize)}`,
    `http://127.0.0.1:44471/chooser?continue=${encodeURIComponent(authorize.replace(':44471', ':44472'))}`,
    'not a URL',
  ]) {
    expect(await atConfiguredGoogleHandoff(browser(url), http)).toBe(false);
    await expect(
      globalActionMenuAlwaysVisible.check(harnessAt(url), undefined, null)
    ).rejects.toThrow('global action menu not visible for actor(s): alice');
  }
  expect(await atConfiguredGoogleHandoff(undefined, http)).toBe(false);
  expect(
    await atConfiguredGoogleHandoff(browser(authorize), { kind: 'in-process' })
  ).toBe(false);
});

function harnessAt(url: string): ProductHarness {
  return {
    session: { ports: { http, ui: { kind: 'bun-webview' } } },
    actors: new Map([
      [
        'alice',
        {
          browser: browser(url),
          ui: {
            get: () => ({
              wait: async () => {
                throw new Error('No app chrome');
              },
            }),
          },
        },
      ],
    ]),
  } as unknown as ProductHarness;
}

// regression: global-menu-monitor-rejects-google-handoff
test('global menu monitor accepts the configured provider and rejects other external pages', async () => {
  await expect(
    globalActionMenuAlwaysVisible.check(harnessAt(authorize), undefined, null)
  ).resolves.toBeUndefined();
  await expect(
    globalActionMenuAlwaysVisible.check(
      harnessAt('https://unexpected.invalid/'),
      undefined,
      null
    )
  ).rejects.toThrow('global action menu not visible for actor(s): alice');
});
