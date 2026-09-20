/** Creating an account from the provider's own screens. */

import { describe, expect, test } from 'bun:test';

import {
  IDP_ADMIN_PREFIX,
  IDP_AUTHORIZE_SUBMIT_PATH,
  IDP_BRAND,
  IDP_PASSWORD,
  IDP_TEST_IDS,
} from '@pkgs/idp-google-sim/shared';

import {
  allowConsent,
  authorizeUrl,
  codeOf,
  createAccountViaScreen,
  createIdpFixture,
  exchangeBody,
  formBody,
  requestIdOf,
  signInWithPassword,
} from './harness';

async function signInPageOf(browser: {
  fetch(input: string, init?: RequestInit): Promise<Response>;
}): Promise<string> {
  return await (await browser.fetch(authorizeUrl())).text();
}

describe('create an account from the sign-in screen', () => {
  test('a new account completes the OAuth round trip', async () => {
    const fixture = await createIdpFixture();
    const browser = fixture.browser();
    const signInPage = await signInPageOf(browser);
    expect(signInPage).toContain(IDP_TEST_IDS.identifierCreateAccount);

    const created = await createAccountViaScreen(browser, signInPage, {
      name: 'Dana Scully',
      email: 'Dana.Scully@example.com',
    });
    const consentHtml = await created.text();
    expect(consentHtml).toContain(IDP_TEST_IDS.consentPage);
    expect(consentHtml).toContain('dana.scully@example.com');

    const code = codeOf(await allowConsent(browser, consentHtml));
    const tokens = (await (
      await browser.fetch('/token', exchangeBody({ code }))
    ).json()) as Record<string, string>;
    const profile = (await (
      await browser.fetch('/v1/userinfo', {
        headers: { authorization: `Bearer ${tokens['access_token'] ?? ''}` },
      })
    ).json()) as Record<string, unknown>;
    expect(profile['email']).toBe('dana.scully@example.com');
    expect(profile['name']).toBe('Dana Scully');
    expect(profile['given_name']).toBe('Dana');
    expect(profile['family_name']).toBe('Scully');

    const account = await fixture.store.accountByEmail(
      'dana.scully@example.com'
    );
    expect(account?.sub).toBe(String(profile['sub']));
    expect(account?.emailVerified).toBe(true);
  });

  test('a duplicate email is refused and the request stays usable', async () => {
    const fixture = await createIdpFixture();
    const browser = fixture.browser();
    const signInPage = await signInPageOf(browser);
    const requestId = requestIdOf(signInPage);

    const duplicate = await browser.fetch(
      IDP_AUTHORIZE_SUBMIT_PATH,
      formBody({
        request_id: requestId,
        step: 'create',
        name: 'Impostor',
        email: 'alice@gmail.com',
      })
    );
    expect(duplicate.status).toBe(400);
    const duplicateHtml = await duplicate.text();
    expect(duplicateHtml).toContain(IDP_TEST_IDS.createAccountPage);
    expect(duplicateHtml).toContain(IDP_TEST_IDS.createAccountError);
    expect(duplicateHtml).toContain('already in use');
    expect(
      await fixture.store.accountByEmail('alice@gmail.com')
    ).not.toBeNull();

    // Same parked request, same browser: retry with a free address works.
    const retry = await browser.fetch(
      IDP_AUTHORIZE_SUBMIT_PATH,
      formBody({
        request_id: requestId,
        step: 'create',
        name: 'Alice Clone',
        email: 'alice.clone@gmail.com',
      })
    );
    expect(retry.status).toBe(200);
    const retryHtml = await retry.text();
    expect(retryHtml).toContain(IDP_TEST_IDS.consentPage);
    expect(
      codeOf(await allowConsent(browser, retryHtml)).startsWith('4/0A')
    ).toBe(true);
  });

  test('a malformed email is refused inline', async () => {
    const fixture = await createIdpFixture();
    const browser = fixture.browser();
    const signInPage = await signInPageOf(browser);
    const res = await browser.fetch(
      IDP_AUTHORIZE_SUBMIT_PATH,
      formBody({
        request_id: requestIdOf(signInPage),
        step: 'create',
        name: 'No Domain',
        email: 'nobody',
      })
    );
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain(IDP_TEST_IDS.createAccountError);
    expect(html).toContain(`valid ${IDP_BRAND.name} account name`);
    expect(await fixture.store.accountByEmail('nobody')).toBeNull();
  });

  test('the created account signs in with the one shared password', async () => {
    const fixture = await createIdpFixture();
    const browser = fixture.browser();
    const signInPage = await signInPageOf(browser);
    const created = await createAccountViaScreen(browser, signInPage, {
      name: 'Ripley',
      email: 'ripley@gmail.com',
    });
    expect(await created.text()).toContain(IDP_TEST_IDS.consentPage);

    // A second browser knows nothing: it must type the shared password.
    const fresh = await signInWithPassword(
      fixture.browser(),
      authorizeUrl(),
      'ripley@gmail.com'
    );
    expect(codeOf(fresh).startsWith('4/0A')).toBe(true);
    expect(IDP_PASSWORD).toBe('password');
  });

  test('the test admin seeds through the same validation, without secrets', async () => {
    const fixture = await createIdpFixture();
    const browser = fixture.browser();
    const ok = await browser.fetch(`${IDP_ADMIN_PREFIX}/accounts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handle: 'carol' }),
    });
    expect(ok.status).toBe(201);
    const seeded = (await ok.json()) as Record<string, unknown>;
    expect(seeded['email']).toBe('carol@gmail.com');
    expect('password' in seeded).toBe(false);

    const bad = await browser.fetch(`${IDP_ADMIN_PREFIX}/accounts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', name: 'Nope' }),
    });
    expect(bad.status).toBe(400);

    const state = (await (
      await browser.fetch(`${IDP_ADMIN_PREFIX}/state`)
    ).json()) as { readonly accounts: readonly Record<string, unknown>[] };
    for (const account of state.accounts) {
      expect('password' in account).toBe(false);
    }
    const signInPage = await (
      await fixture.browser().fetch(authorizeUrl())
    ).text();
    expect(signInPage).toContain(`<code>${IDP_PASSWORD}</code>`);
  });
});
