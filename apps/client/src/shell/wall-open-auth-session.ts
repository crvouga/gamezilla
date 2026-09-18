// @io-wall-ok — browser popup adapter for the OAuth auth-session port.
/**
 * `OpenAuthSession` over `window.open`: launches the IdP authorization URL in
 * a popup and resolves when the popup lands on `callbackUrl` (same origin,
 * read by polling), posts a same-origin message, or broadcasts a callback
 * across COOP browsing-context groups. A blocked popup resolves `{ type:
 * 'locked' }`; an abandoned popup resolves `cancel` after a timeout.
 */

import type { Timers } from '@pkgs/clock';
import type { OpenAuthSession, OpenAuthSessionResult } from './client-env';

export const AUTH_POPUP_NAME = 'gamezilla-auth';
export const AUTH_POPUP_CHANNEL = 'gamezilla-auth';
export const AUTH_POPUP_RESULT_KEY = 'gamezilla.oauth.popup-result';
export const AUTH_POPUP_ACTIVE_KEY = 'gamezilla.oauth.popup-active';

const POLL_INTERVAL_MS = 250;
const POPUP_TIMEOUT_MS = 120_000;
const POPUP_FEATURES = 'popup=yes,width=520,height=680';
type PopupLike = {
  readonly closed: boolean;
  readonly location: { readonly href: string } | null;
  close(): void;
  focus(): void;
};

function readPopupHref(popup: PopupLike): string | null {
  try {
    const href = popup.location?.href;
    return typeof href === 'string' && href.length > 0 ? href : null;
  } catch {
    // Cross-origin while on the IdP: not readable yet.
    return null;
  }
}

function isCallback(href: string, callbackUrl: string): boolean {
  return href.startsWith(callbackUrl);
}

function messageHref(event: MessageEvent, callbackUrl: string): string | null {
  const data: unknown = event.data;
  if (typeof data === 'string' && isCallback(data, callbackUrl)) return data;
  if (typeof data === 'object' && data !== null && 'url' in data) {
    const url: unknown = data.url;
    if (typeof url === 'string' && isCallback(url, callbackUrl)) return url;
  }
  return null;
}

function waitForCallback(
  popup: PopupLike,
  callbackUrl: string,
  timers: Timers
): Promise<OpenAuthSessionResult> {
  const { promise, resolve } = Promise.withResolvers<OpenAuthSessionResult>();
  let settled = false;
  let poll: unknown;
  let timeout: unknown;
  const channel =
    typeof BroadcastChannel === 'undefined'
      ? null
      : new BroadcastChannel(AUTH_POPUP_CHANNEL);
  const finish = (result: OpenAuthSessionResult): void => {
    if (settled) return;
    settled = true;
    if (poll !== undefined) timers.clearInterval(poll);
    if (timeout !== undefined) timers.clearTimeout(timeout);
    window.removeEventListener('message', onMessage);
    window.removeEventListener('storage', onStorage);
    channel?.close();
    if (!popup.closed) popup.close();
    try {
      window.localStorage.removeItem(AUTH_POPUP_ACTIVE_KEY);
    } catch {
      // Storage may be unavailable; message and polling remain available.
    }
    resolve(result);
  };
  const finishFromHref = (href: string): void => {
    if (!isCallback(href, callbackUrl)) return;
    try {
      window.localStorage.removeItem(AUTH_POPUP_RESULT_KEY);
    } catch {
      // Storage may be unavailable; message and polling remain available.
    }
    finish({ type: 'success', url: href });
  };
  const onMessage = (event: MessageEvent): void => {
    if (
      event.currentTarget === window &&
      event.origin !== window.location.origin
    ) {
      return;
    }
    const href = messageHref(event, callbackUrl);
    if (href !== null) finishFromHref(href);
  };
  const onStorage = (event: StorageEvent): void => {
    if (event.key !== AUTH_POPUP_RESULT_KEY || event.newValue === null) return;
    finishFromHref(event.newValue);
  };
  poll = timers.setInterval(() => {
    try {
      const storedHref = window.localStorage.getItem(AUTH_POPUP_RESULT_KEY);
      if (storedHref !== null) {
        finishFromHref(storedHref);
        return;
      }
    } catch {
      // Storage may be unavailable; popup polling remains available.
    }
    // With COOP `same-origin`, a popup appears closed as soon as it visits the
    // cross-origin IdP. The callback handoff, not `closed`, is authoritative.
    if (popup.closed) return;
    const href = readPopupHref(popup);
    if (href !== null) finishFromHref(href);
  }, POLL_INTERVAL_MS);
  timeout = timers.setTimeout(
    () => finish({ type: 'cancel' }),
    POPUP_TIMEOUT_MS
  );
  window.addEventListener('message', onMessage);
  window.addEventListener('storage', onStorage);
  if (channel !== null) channel.addEventListener('message', onMessage);
  try {
    const href = window.localStorage.getItem(AUTH_POPUP_RESULT_KEY);
    if (href !== null) finishFromHref(href);
  } catch {
    // Storage may be unavailable; popup polling remains available.
  }
  return promise;
}

export function createWallOpenAuthSession(timers: Timers): OpenAuthSession {
  return async (authorizationUrl, callbackUrl) => {
    try {
      window.localStorage.removeItem(AUTH_POPUP_RESULT_KEY);
      window.localStorage.setItem(AUTH_POPUP_ACTIVE_KEY, '1');
    } catch {
      // Storage may be unavailable; opener/name handoff remains available.
    }
    const popup = window.open(
      authorizationUrl,
      AUTH_POPUP_NAME,
      POPUP_FEATURES
    ) as PopupLike | null;
    if (popup === null) {
      try {
        window.localStorage.removeItem(AUTH_POPUP_ACTIVE_KEY);
      } catch {
        // Storage may be unavailable.
      }
      return { type: 'locked' };
    }
    popup.focus();
    return waitForCallback(popup, callbackUrl, timers);
  };
}
