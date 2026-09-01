import type { HttpFetch } from '@pkgs/http-client';

import { AUTH_SSO_POPUP_BLOCKED_ERROR } from './auth-client-http';
import type { OpenAuthSession, OpenAuthSessionResult } from './create-auth-client-adapter';

export type InProcessOpenAuthSessionFault =
  | 'cancel'
  | 'dismiss'
  | 'blocked'
  | null;

export type InProcessOpenAuthSessionConfig = {
  readonly fetch: HttpFetch;
  /** Dev chooser subject used when completing OAuth in-process. */
  readonly subject: string;
  /** Optional fault injection for tests. */
  readonly fault?: InProcessOpenAuthSessionFault;
};

/**
 * Deterministic auth-session stub for in-process sim / RNTL. Follows the launch
 * redirect chain and completes the Dev IdP chooser without a real popup.
 */
export function createInProcessOpenAuthSession(
  config: InProcessOpenAuthSessionConfig
): OpenAuthSession {
  return async (authorizationUrl, _callbackUrl) => {
    if (config.fault === 'blocked') {
      throw new Error(AUTH_SSO_POPUP_BLOCKED_ERROR);
    }
    if (config.fault === 'cancel') {
      return { type: 'cancel' };
    }
    if (config.fault === 'dismiss') {
      return { type: 'dismiss' };
    }

    const resolve = (href: string, base: string): string =>
      new URL(href, base).toString();

    const launchRes = await config.fetch(authorizationUrl, {
      method: 'GET',
      redirect: 'manual',
    });
    const authorizeLocation = launchRes.headers.get('location');
    if (authorizeLocation === null) {
      return { type: 'cancel' };
    }

    const authorizeHref = resolve(authorizeLocation, authorizationUrl);
    const authorizeRes = await config.fetch(authorizeHref, {
      method: 'GET',
      redirect: 'manual',
    });
    if (!authorizeRes.ok) {
      return { type: 'cancel' };
    }

    const authorizeUrl = new URL(authorizeHref);
    const state = authorizeUrl.searchParams.get('state') ?? '';
    if (state.length === 0) {
      return { type: 'cancel' };
    }

    const completePath = authorizeUrl.pathname.replace(
      '/authorize',
      '/authorize/complete'
    );
    const completeUrl = `${authorizeUrl.origin}${completePath}`;
    const completeRes = await config.fetch(completeUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        state,
        subject: config.subject,
      }).toString(),
      redirect: 'manual',
    });
    const callbackLocation = completeRes.headers.get('location');
    if (callbackLocation === null) {
      return { type: 'cancel' };
    }

    const callbackHref = resolve(callbackLocation, authorizeHref);
    const callbackRes = await config.fetch(callbackHref, {
      method: 'GET',
      redirect: 'manual',
    });
    const appLocation = callbackRes.headers.get('location');
    if (appLocation === null) {
      return { type: 'cancel' };
    }

    const appHref = resolve(appLocation, callbackHref);
    return { type: 'success', url: appHref };
  };
}

export function mapOpenAuthSessionError(
  err: unknown
): OpenAuthSessionResult | never {
  if (err instanceof Error && err.message === AUTH_SSO_POPUP_BLOCKED_ERROR) {
    throw err;
  }
  throw err;
}
