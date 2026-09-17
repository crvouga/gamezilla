import type { HttpFetch } from '@pkgs/http-client';

import { AUTH_SSO_POPUP_BLOCKED_ERROR } from './auth-client-http';
import type {
  OpenAuthSession,
  OpenAuthSessionResult,
} from './create-auth-client-adapter';
import {
  formSubmitBody,
  type HeadlessButton,
  type HeadlessForm,
  parseFirstForm,
} from './headless-form';

export type InProcessOpenAuthSessionFault =
  | 'cancel'
  | 'dismiss'
  | 'blocked'
  | null;

export type InProcessOpenAuthSessionConfig = {
  /** Must reach both the API and the identity provider. */
  readonly fetch: HttpFetch;
  /** What the simulated person types on the provider's sign-in screen. */
  readonly account: { readonly email: string; readonly password: string };
  /** Optional fault injection for tests. */
  readonly fault?: InProcessOpenAuthSessionFault;
};

/** Enough to cover launch → provider screens → callback → app, with slack. */
const MAX_HOPS = 12;

/**
 * A headless stand-in for the sign-in popup.
 *
 * It follows redirects and fills in whatever form the identity provider
 * serves, rather than knowing the provider's URLs — so the in-process
 * simulation walks the same screens a person would, and a provider that
 * changes its flow breaks here instead of silently diverging.
 */
export function createInProcessOpenAuthSession(
  config: InProcessOpenAuthSessionConfig
): OpenAuthSession {
  return async (authorizationUrl, callbackUrl) => {
    const faulted = faultResult(config.fault);
    if (faulted !== null) return faulted;
    return await walk(config, authorizationUrl, callbackUrl);
  };
}

function faultResult(
  fault: InProcessOpenAuthSessionFault | undefined
): OpenAuthSessionResult | null {
  if (fault === 'blocked') throw new Error(AUTH_SSO_POPUP_BLOCKED_ERROR);
  if (fault === 'cancel') return { type: 'cancel' };
  if (fault === 'dismiss') return { type: 'dismiss' };
  return null;
}

/** Cookies are how the provider remembers the browser between screens. */
function createCookieJar(): {
  header(): string;
  absorb(response: Response): void;
} {
  const jar = new Map<string, string>();
  return {
    header: () =>
      [...jar].map(([name, value]) => `${name}=${value}`).join('; '),
    absorb(response) {
      for (const raw of response.headers.getSetCookie()) {
        const pair = raw.split(';')[0] ?? '';
        const at = pair.indexOf('=');
        if (at > 0) jar.set(pair.slice(0, at), pair.slice(at + 1));
      }
    },
  };
}

function pickButton(form: HeadlessForm, email: string): HeadlessButton | null {
  const mine = form.buttons.find((button) => button.content.includes(email));
  if (mine !== undefined) return mine;
  const approve = form.buttons.find((button) => button.value === 'allow');
  if (approve !== undefined) return approve;
  return form.buttons[form.buttons.length - 1] ?? null;
}

function typedFields(
  form: HeadlessForm,
  account: { readonly email: string; readonly password: string }
): Record<string, string> {
  const typed: Record<string, string> = {};
  for (const name of form.inputNames) {
    if (name.includes('email')) typed[name] = account.email;
    if (name.includes('password')) typed[name] = account.password;
  }
  return typed;
}

type Hop = { readonly url: string; readonly init?: RequestInit };

function submitHop(args: {
  readonly form: HeadlessForm;
  readonly base: string;
  readonly account: { readonly email: string; readonly password: string };
}): Hop {
  const body = formSubmitBody({
    form: args.form,
    typed: typedFields(args.form, args.account),
    button: pickButton(args.form, args.account.email),
  });
  const action = new URL(args.form.action, args.base).toString();
  if (args.form.method === 'get') {
    return { url: `${action}?${body}`, init: { method: 'GET' } };
  }
  return {
    url: action,
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    },
  };
}

async function walk(
  config: InProcessOpenAuthSessionConfig,
  authorizationUrl: string,
  callbackUrl: string
): Promise<OpenAuthSessionResult> {
  const jar = createCookieJar();
  let hop: Hop = { url: authorizationUrl };
  for (let step = 0; step < MAX_HOPS; step += 1) {
    const headers = new Headers(hop.init?.headers);
    const cookies = jar.header();
    if (cookies.length > 0) headers.set('cookie', cookies);
    const response = await config.fetch(hop.url, {
      ...hop.init,
      headers,
      redirect: 'manual',
    });
    jar.absorb(response);
    const location = response.headers.get('location');
    if (location !== null) {
      const next = new URL(location, hop.url).toString();
      if (next.startsWith(callbackUrl)) return { type: 'success', url: next };
      hop = { url: next };
      continue;
    }
    if (!response.ok) return { type: 'cancel' };
    const form = parseFirstForm(await response.text());
    if (form === null) return { type: 'cancel' };
    hop = submitHop({ form, base: hop.url, account: config.account });
  }
  return { type: 'cancel' };
}

export function mapOpenAuthSessionError(
  err: unknown
): OpenAuthSessionResult | never {
  if (err instanceof Error && err.message === AUTH_SSO_POPUP_BLOCKED_ERROR) {
    throw err;
  }
  throw err;
}
