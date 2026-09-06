// @io-wall-ok — browser popup adapter for the OAuth auth-session port.
/**
 * `OpenAuthSession` over `window.open`: launches the IdP authorization URL in
 * a popup and resolves when the popup lands on `callbackUrl` (same origin,
 * read by polling) or posts a `message` carrying the callback URL. A blocked
 * popup resolves `{ type: 'locked' }`; a closed popup resolves `cancel`.
 */

import type { Timers } from '@pkgs/clock';
import type { OpenAuthSession, OpenAuthSessionResult } from './client-env';

const POLL_INTERVAL_MS = 250;
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
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: OpenAuthSessionResult): void => {
      if (settled) return;
      settled = true;
      timers.clearInterval(poll);
      window.removeEventListener('message', onMessage);
      if (!popup.closed) popup.close();
      resolve(result);
    };
    const onMessage = (event: MessageEvent): void => {
      if (event.origin !== window.location.origin) return;
      const href = messageHref(event, callbackUrl);
      if (href !== null) finish({ type: 'success', url: href });
    };
    const poll = timers.setInterval(() => {
      if (popup.closed) {
        finish({ type: 'cancel' });
        return;
      }
      const href = readPopupHref(popup);
      if (href !== null && isCallback(href, callbackUrl)) {
        finish({ type: 'success', url: href });
      }
    }, POLL_INTERVAL_MS);
    window.addEventListener('message', onMessage);
  });
}

export function createWallOpenAuthSession(timers: Timers): OpenAuthSession {
  return async (authorizationUrl, callbackUrl) => {
    const popup = window.open(
      authorizationUrl,
      'gamezilla-auth',
      POPUP_FEATURES
    ) as PopupLike | null;
    if (popup === null) {
      return { type: 'locked' };
    }
    popup.focus();
    return waitForCallback(popup, callbackUrl, timers);
  };
}
