import type { HttpFetch } from '@pkgs/http-client-shared/types';

import { AUTH_SSO_POPUP_BLOCKED_ERROR } from './auth-client-http';
import type {
  OpenAuthSession,
  OpenAuthSessionResult,
} from './auth-client-oauth';
import type { HeadlessButton, HeadlessForm } from './headless-form';
import { formSubmitBody, parseForms } from './headless-form';

export type InProcessOpenAuthSessionFault =
  | 'cancel'
  | 'dismiss'
  | 'blocked'
  | null;

export type InProcessOpenAuthSessionConfig = {
  /** Must reach both the API and the identity provider. */
  readonly fetch: HttpFetch;
  /** The account the simulated person signs in as, by its address. */
  readonly account: { readonly email: string };
  /** What the simulated person answers on the consent screen (default `allow`). */
  readonly consent?: 'allow' | 'deny';
  /**
   * Anything else the person fills in, by field name — Apple's first
   * authorization asks for a name and "Share / Hide My Email"
   * (`{ email_choice: 'hide' }`). Unnamed fields keep their defaults.
   */
  readonly answers?: Readonly<Record<string, string>>;
  /** Optional fault injection for tests. */
  readonly fault?: InProcessOpenAuthSessionFault;
  /**
   * The browser's cookies. Pass one jar per simulated browser so the
   * provider remembers who signed in last time (its account chooser) — a
   * fresh jar per sign-in is a private window every time.
   */
  readonly jar?: AuthCookieJar;
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

/**
 * Host-scoped cookies, as a browser keeps them: two providers that both call
 * their session cookie by the same name must never see each other's.
 */
export type AuthCookieJar = {
  header(url: string): string;
  absorb(url: string, response: Response): void;
};

/** Cookies are how the provider remembers the browser between screens. */
export function createAuthCookieJar(): AuthCookieJar {
  const hosts = new Map<string, Map<string, string>>();
  const hostOf = (url: string): string => new URL(url).host;
  return {
    header: (url) =>
      [...(hosts.get(hostOf(url)) ?? new Map<string, string>())]
        .map(([name, value]) => `${name}=${value}`)
        .join('; '),
    absorb(url, response) {
      const host = hostOf(url);
      const jar = hosts.get(host) ?? new Map<string, string>();
      for (const raw of response.headers.getSetCookie()) {
        const pair = raw.split(';')[0] ?? '';
        const at = pair.indexOf('=');
        if (at > 0) jar.set(pair.slice(0, at), pair.slice(at + 1));
      }
      hosts.set(host, jar);
    },
  };
}

type Submission = {
  readonly form: HeadlessForm;
  readonly button: HeadlessButton | null;
};

/** The first form holding a button that `matches`, with that button. */
function formWith(
  forms: readonly HeadlessForm[],
  matches: (button: HeadlessButton) => boolean
): Submission | null {
  for (const form of forms) {
    const button = form.buttons.find(matches);
    if (button !== undefined) return { form, button };
  }
  return null;
}

/**
 * What the person presses: the chooser row with their address on it; the
 * consent answer; backing out when their account is not on offer; or the one
 * button of a hand-off page ("Continue").
 */
function pickSubmission(
  forms: readonly HeadlessForm[],
  email: string,
  consent: 'allow' | 'deny'
): Submission | null {
  const first = forms[0];
  return (
    formWith(forms, (button) => button.content.includes(email)) ??
    formWith(forms, (button) => button.value === consent) ??
    formWith(forms, (button) => button.value === 'deny') ??
    (first === undefined
      ? null
      : { form: first, button: first.buttons.at(-1) ?? null })
  );
}

function typedFields(
  form: HeadlessForm,
  config: InProcessOpenAuthSessionConfig
): Record<string, string> {
  const typed: Record<string, string> = {};
  for (const name of form.inputNames) {
    if (name === 'email') typed[name] = config.account.email;
  }
  return { ...typed, ...config.answers };
}

type Hop = { readonly url: string; readonly init?: RequestInit };

function submitHop(args: {
  readonly submission: Submission;
  readonly base: string;
  readonly config: InProcessOpenAuthSessionConfig;
}): Hop {
  const { form, button } = args.submission;
  const body = formSubmitBody({
    form,
    typed: typedFields(form, args.config),
    button,
  });
  const action = new URL(form.action, args.base).toString();
  if (form.method === 'get') {
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
  const jar = config.jar ?? createAuthCookieJar();
  let hop: Hop = { url: authorizationUrl };
  for (let step = 0; step < MAX_HOPS; step += 1) {
    const headers = new Headers(hop.init?.headers);
    const cookies = jar.header(hop.url);
    if (cookies.length > 0) headers.set('cookie', cookies);
    const response = await config.fetch(hop.url, {
      ...hop.init,
      headers,
      redirect: 'manual',
    });
    jar.absorb(hop.url, response);
    const location = response.headers.get('location');
    if (location !== null) {
      const next = new URL(location, hop.url).toString();
      if (next.startsWith(callbackUrl)) return { type: 'success', url: next };
      hop = { url: next };
      continue;
    }
    if (!response.ok) return { type: 'cancel' };
    const submission = pickSubmission(
      parseForms(await response.text()),
      config.account.email,
      config.consent ?? 'allow'
    );
    if (submission === null) return { type: 'cancel' };
    hop = submitHop({ submission, base: hop.url, config });
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
