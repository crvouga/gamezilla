/**
 * The relying party's own headless walker against the simulated provider's
 * rendered screens (`./support/simulated-google`): no knowledge of the IdP's
 * markup beyond "there are forms here".
 */

import { describe, expect, test } from 'bun:test';
import type {
  HeadlessButton,
  HeadlessForm,
} from '@pkgs/auth-inhouse-client/headless-form';

import {
  formSubmitBody,
  parseForms,
} from '@pkgs/auth-inhouse-client/headless-form';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { ALICE_EMAIL, simulatedGoogle } from './simulated-google';

const ORIGIN = 'https://idp.test';
const CLIENT_ID = 'walker.apps.googleusercontent.com';
const REDIRECT_URI = 'https://app.test/api/auth/callback/google';

type Wire = (input: string, init?: RequestInit) => Promise<Response>;

/** The provider, behind a browser that keeps its cookies. */
function bootIdp(): Wire {
  const google = simulatedGoogle({
    origin: ORIGIN,
    clientId: CLIENT_ID,
    clientSecret: 'walker-secret',
    redirectUris: [REDIRECT_URI],
    clock: createHarnessClock({ startMs: Date.parse('2024-06-01') }).clock,
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
    const response = await google(
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

function authorizeUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state: 'walker-state',
    code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `/o/oauth2/v2/auth?${params.toString()}`;
}

/** The form holding a button that `matches`, and that button. */
function withButton(
  forms: readonly HeadlessForm[],
  matches: (button: HeadlessButton) => boolean
): { readonly form: HeadlessForm; readonly button: HeadlessButton } {
  for (const form of forms) {
    const button = form.buttons.find(matches);
    if (button !== undefined) return { form, button };
  }
  throw new Error('no such button on the page');
}

async function press(
  wire: Wire,
  pressed: { readonly form: HeadlessForm; readonly button: HeadlessButton },
  typed: Readonly<Record<string, string>> = {}
): Promise<Response> {
  const body = formSubmitBody({ ...pressed, typed });
  const action = new URL(pressed.form.action, ORIGIN).toString();
  if (pressed.form.method === 'get') return await wire(`${action}?${body}`);
  return await wire(action, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
}

describe('headless walker against the provider screens', () => {
  test('the chooser row, then consent, hands a code back to the app', async () => {
    const wire = bootIdp();
    const chooser = parseForms(await (await wire(authorizeUrl())).text());
    const mine = withButton(chooser, (b) => b.content.includes(ALICE_EMAIL));
    expect(mine.form.method).toBe('post');
    expect(Object.keys(mine.form.hidden)).toContain('transaction');

    const consent = parseForms(await (await press(wire, mine)).text());
    const allow = withButton(consent, (b) => b.value === 'allow');
    expect(allow.button.name).toBe('action');
    expect(consent.flatMap((f) => f.buttons.map((b) => b.value))).toContain(
      'deny'
    );

    const done = await press(wire, allow);
    expect(done.status).toBe(302);
    const location = new URL(done.headers.get('location') ?? '');
    expect(`${location.origin}${location.pathname}`).toBe(REDIRECT_URI);
    expect(location.searchParams.get('state')).toBe('walker-state');
    expect(location.searchParams.get('code')).toBeTruthy();
  });

  test('declining on the chooser hands an error back to the app', async () => {
    const wire = bootIdp();
    const chooser = parseForms(await (await wire(authorizeUrl())).text());
    const done = await press(
      wire,
      withButton(chooser, (b) => b.value === 'deny')
    );
    expect(done.status).toBe(302);
    const location = new URL(done.headers.get('location') ?? '');
    expect(location.searchParams.get('error')).toBe('access_denied');
    expect(location.searchParams.get('state')).toBe('walker-state');
  });

  test('a new account made on the provider goes on to consent', async () => {
    const wire = bootIdp();
    const chooser = parseForms(await (await wire(authorizeUrl())).text());
    const create = withButton(chooser, (b) => b.content.includes('Create'));
    const signup = parseForms(await (await press(wire, create)).text());
    const submit = withButton(signup, (b) => b.content.includes('Create'));
    expect(submit.form.inputNames).toEqual(['name', 'email']);
    const consent = await press(wire, submit, {
      name: 'Walker Test',
      email: 'walker@gmail.com',
    });
    const forms = parseForms(await consent.text());
    expect(withButton(forms, (b) => b.value === 'allow').button.name).toBe(
      'action'
    );
  });
});
