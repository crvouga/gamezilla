// @io-wall-ok — browser popup adapter for the OAuth auth-session port.
/**
 * `OpenAuthSession` over `window.open`: launches the IdP authorization URL in
 * a popup and resolves when its callback returns to this origin. Google may
 * sever the popup's WindowProxy during cross-origin navigation, so the
 * callback also broadcasts its URL to the original tab.
 */

import type { Timers } from '@pkgs/clock';
import type { CreateId } from '@pkgs/uuid/create-id';
import type { OpenAuthSession, OpenAuthSessionResult } from './client-env';

const POLL_INTERVAL_MS = 250;
const AUTH_TIMEOUT_MS = 300_000;
const POPUP_FEATURES = 'popup=yes,width=520,height=680';
const AUTH_CHANNEL = 'gamezilla-auth-callback';
const POPUP_PARAM = 'authPopup';

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
  try {
    const actual = new URL(href);
    const expected = new URL(callbackUrl);
    return (
      actual.origin === expected.origin &&
      actual.pathname === expected.pathname &&
      actual.searchParams.get(POPUP_PARAM) ===
        expected.searchParams.get(POPUP_PARAM) &&
      (actual.searchParams.has('code') || actual.searchParams.has('error'))
    );
  } catch {
    return false;
  }
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
  timers: Timers,
  channel: BroadcastChannel
): Promise<OpenAuthSessionResult> {
  const parentWindow = window;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: OpenAuthSessionResult): void => {
      if (settled) return;
      settled = true;
      timers.clearInterval(poll);
      timers.clearTimeout(timeout);
      parentWindow.removeEventListener('message', onMessage);
      channel.removeEventListener('message', onBroadcast);
      channel.close();
      if (!popup.closed) popup.close();
      resolve(result);
    };
    const onMessage = (event: MessageEvent): void => {
      if (event.origin !== parentWindow.location.origin) return;
      const href = messageHref(event, callbackUrl);
      if (href !== null) finish({ type: 'success', url: href });
    };
    const onBroadcast = (event: MessageEvent): void => {
      const href = messageHref(event, callbackUrl);
      if (href !== null) finish({ type: 'success', url: href });
    };
    const poll = timers.setInterval(() => {
      const href = readPopupHref(popup);
      if (href !== null && isCallback(href, callbackUrl)) {
        finish({ type: 'success', url: href });
      }
    }, POLL_INTERVAL_MS);
    const timeout = timers.setTimeout(
      () => finish({ type: 'cancel' }),
      AUTH_TIMEOUT_MS
    );
    parentWindow.addEventListener('message', onMessage);
    channel.addEventListener('message', onBroadcast);
  });
}

export function createWallOpenAuthSession(
  timers: Timers,
  createId: CreateId
): OpenAuthSession {
  return async (authorizationUrl, callbackUrl) => {
    const popupCallback = new URL(callbackUrl);
    popupCallback.searchParams.set(POPUP_PARAM, createId());
    const launch = new URL(authorizationUrl);
    launch.searchParams.set('callbackUrl', popupCallback.toString());
    const channel = new BroadcastChannel(AUTH_CHANNEL);
    const popup = window.open(
      launch.toString(),
      'gamezilla-auth',
      POPUP_FEATURES
    ) as PopupLike | null;
    if (popup === null) {
      channel.close();
      return { type: 'locked' };
    }
    popup.focus();
    return waitForCallback(popup, popupCallback.toString(), timers, channel);
  };
}

/** Hand a completed popup callback to the original app tab. */
export function handOffPopupAuthCallback(timers: Timers): boolean {
  const callbackWindow = window;
  const url = new URL(callbackWindow.location.href);
  if (
    url.pathname !== '/sso-callback' ||
    !url.searchParams.has(POPUP_PARAM) ||
    (!url.searchParams.has('code') && !url.searchParams.has('error'))
  ) {
    return false;
  }
  const channel = new BroadcastChannel(AUTH_CHANNEL);
  channel.postMessage({ url: url.toString() });
  channel.close();
  callbackWindow.opener?.postMessage({ url: url.toString() }, url.origin);
  timers.setTimeout(() => callbackWindow.close(), 250);
  return true;
}
