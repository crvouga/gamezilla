// @io-wall-ok — browser navigation adapter for the OAuth auth-session port.
/**
 * OAuth uses the current tab, so browsers need no popup support. The callback
 * route completes sign-in after the new document loads. This document's
 * operation stays pending so the modal never mistakes departure for success.
 */

export type OpenAuthSessionResult = {
  readonly type: 'success' | 'cancel' | 'dismiss' | 'locked';
  readonly url?: string | null;
};

export type OpenAuthSession = (
  authorizationUrl: string,
  callbackUrl: string
) => Promise<OpenAuthSessionResult>;

export function createWallOpenAuthSession(): OpenAuthSession {
  return (authorizationUrl) => {
    window.location.assign(authorizationUrl);
    return new Promise<OpenAuthSessionResult>(() => {
      // Completion belongs to the callback document, not the departing one.
    });
  };
}
