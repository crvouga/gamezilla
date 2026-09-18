/**
 * The browser half of a sign-in: follow redirects between the auth app and
 * the provider, fill in whatever screens the provider serves, and stop when
 * the chain leaves both origins — that last hop is the app's own callback.
 */

import {
  formSubmitBody,
  type HeadlessForm,
  parseFirstForm,
} from '@pkgs/auth/client';

import { IDP_ORIGIN, IDP_PASSWORD, idpAccountEmail } from './idp-node';
import { AUTH_SYSTEM_BASE_URL } from './types';

const MAX_HOPS = 12;

function isProviderOrApi(url: string): boolean {
  return url.startsWith(IDP_ORIGIN) || url.startsWith(AUTH_SYSTEM_BASE_URL);
}

function submit(form: HeadlessForm, base: string, subject: string) {
  const email = idpAccountEmail(subject);
  const chosen =
    form.buttons.find((button) => button.content.includes(email)) ??
    form.buttons.find((button) => button.value === 'allow') ??
    form.buttons[form.buttons.length - 1] ??
    null;
  const typed: Record<string, string> = {};
  for (const name of form.inputNames) {
    if (name.includes('email')) typed[name] = email;
    if (name.includes('password')) typed[name] = IDP_PASSWORD;
  }
  return {
    url: new URL(form.action, base).toString(),
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: formSubmitBody({ form, typed, button: chosen }),
      redirect: 'manual' as const,
    },
  };
}

/**
 * Returns the app-side exchange code, or `null` when the flow ended without
 * one (denied consent, a provider fault, a rejected callback URL).
 */
export async function walkIdpScreens(args: {
  readonly wire: (url: string, init?: RequestInit) => Promise<Response>;
  readonly startUrl: string;
  readonly subject: string;
}): Promise<string | null> {
  let hop: { url: string; init?: RequestInit } = {
    url: args.startUrl,
    init: { method: 'GET', redirect: 'manual' },
  };
  const cookies = new Map<string, string>();
  for (let step = 0; step < MAX_HOPS; step += 1) {
    const headers = new Headers(hop.init?.headers);
    if (cookies.size > 0) {
      headers.set(
        'cookie',
        [...cookies].map(([name, value]) => `${name}=${value}`).join('; ')
      );
    }
    const response = await args.wire(hop.url, { ...hop.init, headers });
    for (const raw of response.headers.getSetCookie()) {
      const pair = raw.split(';')[0] ?? '';
      const at = pair.indexOf('=');
      if (at > 0) cookies.set(pair.slice(0, at), pair.slice(at + 1));
    }
    const location = response.headers.get('location');
    if (location !== null) {
      const next = new URL(location, hop.url).toString();
      if (!isProviderOrApi(next)) {
        return new URL(next).searchParams.get('code');
      }
      hop = { url: next, init: { method: 'GET', redirect: 'manual' } };
      continue;
    }
    if (!response.ok) return null;
    const form = parseFirstForm(await response.text());
    if (form === null) return null;
    hop = submit(form, hop.url, args.subject);
  }
  return null;
}
