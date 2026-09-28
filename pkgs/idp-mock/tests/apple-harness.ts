/**
 * Apple-flavored fixture: an Apple-flavored provider with the example app
 * (`./example-app`) registered as its Services ID, and helpers that walk the
 * sign-in to its `form_post` hand-off.
 */

import {
  IDP_AUTHORIZE_SUBMIT_PATH,
  IDP_PASSWORD,
  IDP_TEST_IDS,
} from '@pkgs/idp-mock/shared';

import {
  APPLE_CLIENT_ID,
  APPLE_REDIRECT_URI,
  type AppleRp,
  createAppleRp,
} from './example-app';
import {
  createIdpFixture,
  formBody,
  type IdpBrowser,
  type IdpFixture,
  requestIdOf,
  submitIdentifier,
  submitPassword,
} from './harness';

export type AppleFixture = IdpFixture & {
  readonly rp: AppleRp;
  /** Notifications the provider POSTed to the relying party. */
  readonly delivered: { readonly url: string; readonly body: string }[];
};

export async function createAppleFixture(): Promise<AppleFixture> {
  const delivered: { url: string; body: string }[] = [];
  let clockRef: () => number = () => 0;
  const rp = await createAppleRp(() => clockRef());
  const fixture = await createIdpFixture({
    provider: 'apple',
    clients: [rp.client],
    http: {
      async fetch(input, init) {
        delivered.push({ url: String(input), body: String(init?.body ?? '') });
        return new Response(null, { status: 200 });
      },
    },
  });
  clockRef = () => fixture.clock.now();
  return { ...fixture, rp, delivered };
}

export function appleAuthorizeUrl(
  overrides: Record<string, string> = {}
): string {
  const params = new URLSearchParams({
    client_id: APPLE_CLIENT_ID,
    redirect_uri: APPLE_REDIRECT_URI,
    response_type: 'code',
    response_mode: 'form_post',
    scope: 'name email',
    state: 'state-apple',
    nonce: 'nonce-apple',
    ...overrides,
  });
  for (const [key, value] of Object.entries(overrides)) {
    if (value === '') params.delete(key);
  }
  return `/auth/authorize?${params.toString()}`;
}

/** Sign in as `email` and stop on whatever screen follows the password. */
export async function appleSignIn(
  browser: IdpBrowser,
  url: string,
  email: string
): Promise<string> {
  const entry = await (await browser.fetch(url)).text();
  if (!entry.includes(IDP_TEST_IDS.identifierPage)) return entry;
  const identified = await submitIdentifier(browser, entry, email);
  const authed = await submitPassword(
    browser,
    await identified.text(),
    IDP_PASSWORD
  );
  return await authed.text();
}

export async function appleConsent(
  browser: IdpBrowser,
  consentHtml: string,
  fields: Record<string, string> = {}
): Promise<Response> {
  return await browser.fetch(
    IDP_AUTHORIZE_SUBMIT_PATH,
    formBody({
      request_id: requestIdOf(consentHtml),
      step: 'consent',
      decision: 'allow',
      ...fields,
    })
  );
}

/** The hidden fields of the `form_post` hand-off document. */
export function formPostFields(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of html.matchAll(/<input\b[^>]*>/gi)) {
    const name = /name="([^"]*)"/.exec(match[0])?.[1];
    const value = /value="([^"]*)"/.exec(match[0])?.[1] ?? '';
    if (name !== undefined) {
      out[name] = value.replaceAll('&quot;', '"').replaceAll('&amp;', '&');
    }
  }
  return out;
}

export function formPostAction(html: string): string {
  return /<form[^>]*action="([^"]*)"/.exec(html)?.[1] ?? '';
}

export async function appleExchange(
  fixture: AppleFixture,
  fields: Record<string, string>
): Promise<Response> {
  return await fixture.browser().fetch(
    '/auth/token',
    formBody({
      client_id: APPLE_CLIENT_ID,
      client_secret: await fixture.rp.secret(),
      grant_type: 'authorization_code',
      redirect_uri: APPLE_REDIRECT_URI,
      ...fields,
    })
  );
}
