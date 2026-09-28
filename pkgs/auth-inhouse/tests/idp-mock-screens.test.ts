/**
 * The relying party's own headless walker against the provider's rendered
 * screens: no knowledge of the IdP's markup beyond "there is a form here".
 */

import { describe, expect, test } from 'bun:test';

import {
  createIdpMockApp,
  createIdpSigningKeys,
  DEFAULT_GOOGLE_ACCOUNTS,
  IdpStore,
} from '@pkgs/idp-mock/server';
import {
  IDP_AUTHORIZE_CREATE_PATH,
  IDP_AUTHORIZE_SUBMIT_PATH,
  IDP_PASSWORD,
  IDP_TEST_IDS,
  type IdpClient,
} from '@pkgs/idp-mock/shared';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite/impl-mockingbird-sqlite';
import {
  formSubmitBody,
  type HeadlessButton,
  type HeadlessForm,
  parseFirstForm,
} from '../src/client';

/**
 * One RSA key pair per file: minting RS256 keys is the costliest part of an
 * IdP boot, and no test here is about key generation. Every test still boots
 * its own store and app.
 */
const SIGNING_KEYS = createIdpSigningKeys();

const CLIENT: IdpClient = {
  clientId: 'walker.apps.googleusercontent.com',
  clientSecret: 'walker-secret',
  redirectUris: ['https://app.test/api/auth/callback/google'],
  appName: 'Walker App',
};

const ORIGIN = 'https://idp.test';

type Wire = (input: string, init?: RequestInit) => Promise<Response>;

async function bootIdp(): Promise<Wire> {
  const store = await IdpStore.open({
    provider: 'google',
    sqlClient: SqlClientImplMockingbirdSqlite.open({ seed: 3 }),
    clock: { now: () => Date.parse('2024-06-01T00:00:00.000Z') },
    createId: (() => {
      let n = 0;
      return () => `walker-${(n += 1)}`;
    })(),
    createKeys: () => SIGNING_KEYS,
  });
  const idp = await createIdpMockApp({
    store,
    clients: [CLIENT],
    accounts: DEFAULT_GOOGLE_ACCOUNTS,
    issuer: ORIGIN,
  });
  const cookies = new Map<string, string>();
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    if (cookies.size > 0) {
      headers.set(
        'cookie',
        [...cookies].map(([k, v]) => `${k}=${v}`).join('; ')
      );
    }
    const response = await idp.app.fetch(
      new Request(new URL(input, ORIGIN).toString(), { ...init, headers })
    );
    for (const raw of response.headers.getSetCookie()) {
      const pair = raw.split(';')[0] ?? '';
      const at = pair.indexOf('=');
      if (at > 0) cookies.set(pair.slice(0, at), pair.slice(at + 1));
    }
    return response;
  };
}

function authorizeUrl(overrides: Record<string, string> = {}): string {
  const params = new URLSearchParams({
    client_id: CLIENT.clientId,
    redirect_uri: CLIENT.redirectUris[0] ?? '',
    response_type: 'code',
    scope: 'openid email profile',
    state: 'walker-state',
    ...overrides,
  });
  return `/o/oauth2/v2/auth?${params.toString()}`;
}

async function formAt(wire: Wire, url: string): Promise<HeadlessForm> {
  const html = await (await wire(url)).text();
  const form = parseFirstForm(html);
  if (form === null) throw new Error(`no form at ${url}`);
  return form;
}

async function formOf(response: Response): Promise<HeadlessForm> {
  const form = parseFirstForm(await response.text());
  if (form === null) throw new Error('no form in the response');
  return form;
}

function submit(
  wire: Wire,
  form: HeadlessForm,
  args: {
    readonly typed: Record<string, string>;
    readonly button: HeadlessButton | null;
  }
): Promise<Response> {
  const body = formSubmitBody({
    form,
    typed: args.typed,
    button: args.button,
  });
  return wire(new URL(form.action, ORIGIN).toString(), {
    method: form.method === 'get' ? 'GET' : 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
}

function buttonNamed(
  form: HeadlessForm,
  predicate: (b: HeadlessButton) => boolean
): HeadlessButton | null {
  return form.buttons.find(predicate) ?? null;
}

/** Type the address into step 1, then the password into step 2. */
async function signIn(wire: Wire): Promise<Response> {
  const identifier = await formAt(wire, authorizeUrl());
  expect(identifier.hidden['step']).toBe('identifier');
  expect(identifier.inputNames).toEqual(['email']);
  const password = await formOf(
    await submit(wire, identifier, {
      typed: { email: 'alice@gmail.com' },
      button: buttonNamed(
        identifier,
        (b) => b.testId === IDP_TEST_IDS.identifierNext
      ),
    })
  );
  expect(password.hidden['step']).toBe('password');
  expect(password.inputNames).toEqual(['password']);
  return await submit(wire, password, {
    typed: { password: IDP_PASSWORD },
    button: buttonNamed(
      password,
      (b) => b.testId === IDP_TEST_IDS.passwordNext
    ),
  });
}

describe('headless walker against the Solid screens', () => {
  test('both sign-in steps parse and submit exactly as the auth client would', async () => {
    const wire = await bootIdp();
    const identifier = await formAt(wire, authorizeUrl());
    expect(identifier.method).toBe('post');
    expect(identifier.action).toBe(IDP_AUTHORIZE_SUBMIT_PATH);
    expect(identifier.hidden['request_id']).toBeTruthy();
    expect(identifier.hidden['step']).toBe('identifier');
    expect(identifier.inputNames).toEqual(['email']);

    const authed = await signIn(wire);
    const consentHtml = await authed.text();
    expect(consentHtml).toContain(IDP_TEST_IDS.consentPage);
    const consentForm = parseFirstForm(consentHtml);
    expect(consentForm?.hidden['step']).toBe('consent');
    const allow = buttonNamed(
      consentForm ?? identifier,
      (b) => b.value === 'allow'
    );
    expect(allow?.name).toBe('decision');
    const done = await submit(wire, consentForm ?? identifier, {
      typed: {},
      button: allow,
    });
    expect(done.status).toBe(302);
    const location = new URL(done.headers.get('location') ?? '');
    expect(location.searchParams.get('state')).toBe('walker-state');
    expect(location.searchParams.get('code')?.startsWith('4/0A')).toBe(true);
  });

  test('the chooser offers the account row the walker looks for', async () => {
    const wire = await bootIdp();
    await (await signIn(wire)).text();

    const chooser = await formAt(
      wire,
      authorizeUrl({ prompt: 'select_account' })
    );
    expect(chooser.hidden['step']).toBe('choose');
    const mine = buttonNamed(chooser, (b) =>
      b.content.includes('alice@gmail.com')
    );
    expect(mine?.name).toBe('sub');
    expect(mine?.value).toBeTruthy();
    const consent = await submit(wire, chooser, {
      typed: {},
      button: mine,
    });
    expect(await consent.text()).toContain(IDP_TEST_IDS.consentPage);
  });

  test('the create-account form parses even though it is reached by a link', async () => {
    const wire = await bootIdp();
    const html = await (await wire(authorizeUrl())).text();
    const href = /href="([^"]*\/o\/oauth2\/v2\/auth\/create\?[^"]*)"/.exec(
      html
    )?.[1];
    expect(href).toContain(IDP_AUTHORIZE_CREATE_PATH);
    const create = await formAt(wire, href ?? '');
    expect(create.hidden['step']).toBe('create');
    expect(create.inputNames).toEqual(['name', 'email']);
    expect(
      create.buttons.some((b) => b.testId === IDP_TEST_IDS.createAccountSubmit)
    ).toBe(true);
    const created = await submit(wire, create, {
      typed: { name: 'Walker Test', email: 'walker@gmail.com' },
      button: buttonNamed(create, (b) => b.value === ''),
    });
    expect(await created.text()).toContain(IDP_TEST_IDS.consentPage);
  });
});
