import { describe, expect, test } from 'bun:test';
import {
  IDP_AUTHORIZE_SUBMIT_PATH,
  IDP_PASSWORD,
  IDP_TEST_IDS,
} from '@pkgs/idp-mock/shared';
import { GOOGLE_CLIENT } from './example-app';
import {
  createIdpFixture,
  formBody,
  type IdpBrowser,
  type IdpFixture,
  requestIdOf,
  submitIdentifier,
  submitPassword,
} from './harness';

const REDIRECT_URI = GOOGLE_CLIENT.redirectUris[0] ?? '';

function authorizeUrl(overrides: Record<string, string> = {}): string {
  return `/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: GOOGLE_CLIENT.clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state: 'state-123',
    ...overrides,
  }).toString()}`;
}

/** Both sign-in steps, stopping on whatever screen follows. */
async function passwordSignIn(
  browser: IdpBrowser,
  url: string
): Promise<string> {
  const html = await (await browser.fetch(url)).text();
  const identified = await submitIdentifier(browser, html, 'alice@gmail.com');
  const authed = await submitPassword(
    browser,
    await identified.text(),
    IDP_PASSWORD
  );
  return await authed.text();
}

async function allow(browser: IdpBrowser, html: string): Promise<Response> {
  return await browser.fetch(
    IDP_AUTHORIZE_SUBMIT_PATH,
    formBody({
      request_id: requestIdOf(html),
      step: 'consent',
      decision: 'allow',
    })
  );
}

async function signedInBrowser(fixture: IdpFixture): Promise<IdpBrowser> {
  const browser = fixture.browser();
  await allow(browser, await passwordSignIn(browser, authorizeUrl()));
  return browser;
}

describe('idp screens', () => {
  test('a fresh browser shows the local account guidance', async () => {
    const fixture = await createIdpFixture();
    const html = await (await fixture.browser().fetch(authorizeUrl())).text();
    expect(html).toContain(IDP_TEST_IDS.identifierAccounts);
    expect(html).toContain('alice@gmail.com');
    expect(html).toContain('bob@gmail.com');
    expect(html).toContain(IDP_PASSWORD);
  });
  test('a browser that already has a session sees the chooser', async () => {
    const fixture = await createIdpFixture();
    const browser = await signedInBrowser(fixture);
    const html = await (
      await browser.fetch(authorizeUrl({ prompt: 'select_account' }))
    ).text();
    expect(html).toContain(IDP_TEST_IDS.chooserPage);
    expect(html).toContain('alice@gmail.com');
  });

  test('an approved grant skips consent on the next run', async () => {
    const fixture = await createIdpFixture();
    const browser = await signedInBrowser(fixture);
    const again = await browser.fetch(authorizeUrl());
    expect(again.status).toBe(302);
    expect(again.headers.get('location') ?? '').toContain('code=');
  });

  test('cancelling consent returns access_denied', async () => {
    const fixture = await createIdpFixture();
    const browser = fixture.browser();
    const consentHtml = await passwordSignIn(browser, authorizeUrl());
    const denied = await browser.fetch(
      IDP_AUTHORIZE_SUBMIT_PATH,
      formBody({
        request_id: requestIdOf(consentHtml),
        step: 'consent',
        decision: 'deny',
      })
    );
    const back = new URL(denied.headers.get('location') ?? '');
    expect(back.searchParams.get('error')).toBe('access_denied');
    expect(back.searchParams.get('state')).toBe('state-123');
  });

  test('a wrong password stays on step 2 with Google copy', async () => {
    const fixture = await createIdpFixture();
    const browser = fixture.browser();
    const html = await (await browser.fetch(authorizeUrl())).text();
    const identified = await submitIdentifier(browser, html, 'alice@gmail.com');
    const retry = await submitPassword(
      browser,
      await identified.text(),
      'nope'
    );
    expect(retry.status).toBe(401);
    const retryHtml = await retry.text();
    expect(retryHtml).toContain(IDP_TEST_IDS.passwordPage);
    expect(retryHtml).toContain('Wrong password.');
  });

  test('an unregistered redirect URI never redirects', async () => {
    const fixture = await createIdpFixture();
    const res = await fixture
      .browser()
      .fetch(authorizeUrl({ redirect_uri: 'https://evil.test/steal' }));
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain(IDP_TEST_IDS.errorPage);
    expect(html).toContain('redirect_uri_mismatch');
  });

  test('an unknown client is refused', async () => {
    const fixture = await createIdpFixture();
    const res = await fixture
      .browser()
      .fetch(authorizeUrl({ client_id: 'nobody.apps.googleusercontent.com' }));
    expect(res.status).toBe(401);
    expect(await res.text()).toContain('invalid_client');
  });

  test('prompt=none without a session errors instead of painting UI', async () => {
    const fixture = await createIdpFixture();
    const res = await fixture.browser().fetch(authorizeUrl({ prompt: 'none' }));
    expect(res.status).toBe(302);
    expect(res.headers.get('location') ?? '').toContain('error=login_required');
  });
});

describe('idp faults', () => {
  test('the token endpoint can be made to fail', async () => {
    const fixture = await createIdpFixture();
    await fixture.store.setFaults({
      ...(await fixture.store.faults()),
      tokenEndpoint: 'server_error',
    });
    const res = await fixture.browser().fetch('/token', formBody({}));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'internal_failure' });
  });

  test('consent can be forced to deny', async () => {
    const fixture = await createIdpFixture();
    await fixture.store.setFaults({
      ...(await fixture.store.faults()),
      denyConsent: true,
    });
    const browser = fixture.browser();
    const html = await (await browser.fetch(authorizeUrl())).text();
    const identified = await submitIdentifier(browser, html, 'alice@gmail.com');
    const res = await submitPassword(
      browser,
      await identified.text(),
      IDP_PASSWORD
    );
    expect(res.headers.get('location') ?? '').toContain('error=access_denied');
  });

  test('offline access yields a refresh token that mints new access tokens', async () => {
    const fixture = await createIdpFixture();
    const browser = fixture.browser();
    const consentHtml = await passwordSignIn(
      browser,
      authorizeUrl({ access_type: 'offline' })
    );
    const done = await allow(browser, consentHtml);
    const code =
      new URL(done.headers.get('location') ?? '').searchParams.get('code') ??
      '';
    const first = (await (
      await browser.fetch(
        '/token',
        formBody({
          client_id: GOOGLE_CLIENT.clientId,
          client_secret: GOOGLE_CLIENT.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: REDIRECT_URI,
        })
      )
    ).json()) as Record<string, string>;
    expect(first['refresh_token']?.startsWith('1//0')).toBe(true);

    const refreshed = await browser.fetch(
      '/token',
      formBody({
        client_id: GOOGLE_CLIENT.clientId,
        client_secret: GOOGLE_CLIENT.clientSecret,
        refresh_token: first['refresh_token'] ?? '',
        grant_type: 'refresh_token',
      })
    );
    const next = (await refreshed.json()) as Record<string, string>;
    expect(next['access_token']).not.toBe(first['access_token']);
    expect(next['refresh_token']).toBeUndefined();
  });
});
