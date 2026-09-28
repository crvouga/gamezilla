/**
 * The no-JS contract: every screen the provider can show, rendered server-side
 * into one document with a real form, the boot state, the stylesheet inlined
 * and the SPA referenced as one cached request.
 */

import { describe, expect, test } from 'bun:test';
import {
  IDP_SPA_CSS,
  IDP_SPA_JS,
  renderScreenHtml,
} from '@pkgs/idp-mock/server';
import {
  IDP_ASSET_CSS_PATH,
  IDP_ASSET_JS_PATH,
  IDP_BOOT_STATE_ELEMENT_ID,
  IDP_FAVICON_PATH,
  IDP_TEST_IDS,
  type IdpAccount,
  type IdpScreenState,
} from '@pkgs/idp-mock/shared';
import { EXAMPLE_APP_NAME } from './example-app';
import { createIdpFixture, screenStateOf } from './harness';

const ACCOUNT: IdpAccount = {
  sub: '110000000000000000001',
  email: 'alice@gmail.com',
  emailVerified: true,
  name: 'Alice Example',
  givenName: 'Alice',
  familyName: 'Example',
  picture: 'https://example.test/a.png',
  hd: null,
  realUserStatus: 1,
};

const STATES: readonly IdpScreenState[] = [
  {
    kind: 'identifier',
    requestId: 'req-1',
    appName: EXAMPLE_APP_NAME,
    email: '',
    error: null,
    accounts: [ACCOUNT],
  },
  {
    kind: 'password',
    requestId: 'req-1',
    appName: EXAMPLE_APP_NAME,
    account: ACCOUNT,
    error: null,
    hasPasskey: false,
  },
  {
    kind: 'chooser',
    requestId: 'req-1',
    appName: EXAMPLE_APP_NAME,
    accounts: [ACCOUNT],
  },
  {
    kind: 'create-account',
    requestId: 'req-1',
    appName: EXAMPLE_APP_NAME,
    name: '',
    email: '',
    error: null,
  },
  {
    kind: 'consent',
    requestId: 'req-1',
    appName: EXAMPLE_APP_NAME,
    account: ACCOUNT,
    scopes: ['openid', 'email', 'profile'],
    apple: null,
  },
  {
    kind: 'error',
    status: 400,
    error: 'invalid_request',
    detail: 'This sign-in request expired.',
  },
];

/** The step each form must carry, and the fields it must collect. */
const FORM_SHAPE: Record<
  string,
  { readonly step: string; readonly names: string[] } | null
> = {
  identifier: { step: 'identifier', names: ['email'] },
  password: { step: 'password', names: ['password'] },
  chooser: { step: 'choose', names: [] },
  'create-account': { step: 'create', names: ['name', 'email'] },
  consent: { step: 'consent', names: [] },
  error: null,
};

function inputNamesOf(html: string): string[] {
  const form = /<form\b[^>]*>([\s\S]*?)<\/form>/i.exec(html)?.[1] ?? '';
  const names: string[] = [];
  for (const tag of form.matchAll(/<input\b[^>]*>/gi)) {
    const name = /name="([^"]*)"/.exec(tag[0])?.[1];
    if (name !== undefined && !/type="hidden"/i.test(tag[0])) names.push(name);
  }
  return names;
}

describe('server-rendered screens', () => {
  for (const state of STATES) {
    test(`the ${state.kind} screen carries its form, boot state and assets`, async () => {
      const html = await renderScreenHtml(state, 'google');
      const shape = FORM_SHAPE[state.kind];

      expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
      expect(html).toContain('<html lang="en" data-idp-provider="google">');
      expect(html).toContain(`<div id="idp-root">`);
      expect(html).toContain(`<style>${IDP_SPA_CSS}</style>`);
      expect(html).toContain(`src="${IDP_ASSET_JS_PATH}"`);
      expect(html).toContain(`href="${IDP_FAVICON_PATH}"`);
      expect(html).toContain(`id="${IDP_BOOT_STATE_ELEMENT_ID}"`);
      expect(html).toContain(`<link rel="icon"`);
      expect(screenStateOf(html).kind).toBe(state.kind);

      if (shape === null || shape === undefined) {
        expect(html).toContain(IDP_TEST_IDS.errorPage);
        expect(html).not.toContain('<form');
        return;
      }
      expect(html).toContain(`name="step" value="${shape.step}"`);
      expect(inputNamesOf(html)).toEqual(shape.names);
      expect(html).toContain('action="/o/oauth2/v2/auth/submit"');
    });
  }

  test('the embedded bundle is complete and safe to inline', () => {
    expect(IDP_SPA_JS.length).toBeGreaterThan(1000);
    expect(IDP_SPA_CSS.length).toBeGreaterThan(1000);
    expect(IDP_SPA_JS).not.toContain('</script');
    expect(IDP_SPA_CSS).not.toContain('</style');
  });

  test('the assets are served with the right content types', async () => {
    const fixture = await createIdpFixture();
    const browser = fixture.browser();
    const js = await browser.fetch(IDP_ASSET_JS_PATH);
    expect(js.status).toBe(200);
    expect(js.headers.get('content-type')).toContain('text/javascript');
    expect((await js.text()).length).toBe(IDP_SPA_JS.length);

    const css = await browser.fetch(IDP_ASSET_CSS_PATH);
    expect(css.status).toBe(200);
    expect(css.headers.get('content-type')).toContain('text/css');

    const favicon = await browser.fetch(IDP_FAVICON_PATH);
    expect(favicon.status).toBe(200);
    expect(favicon.headers.get('content-type')).toContain('image/svg+xml');

    const missing = await browser.fetch('/idp-assets/nope.js');
    expect(missing.status).toBe(404);
  });
});
