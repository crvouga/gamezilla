/**
 * Dev-only sign-in trigger that fires the Better Auth `genericOAuth` flow
 * for the in-repo {@link DEV_PROVIDER}. Mirrors {@link useSignIn} but calls
 * `signIn.oauth2({ providerId: 'dev', ... })`. Visible only when the API
 * origin is local (see {@link isLocalApiOrigin}); the server-side provider
 * is gated symmetrically, so the call is a no-op against production.
 */
import { useCallback } from 'react';

import { DEV_PROVIDER } from '../shared/auth-entities';
import { useAuthClient } from './auth-client-provider';

type SignInOauth2Result = {
  error?: { message?: string } | null;
  data?: { url?: string; redirect?: boolean } | null;
};

function resolveCallbackUrl(): string {
  // On React Native/Hermes `window` exists but `window.location` does not, so
  // guard on `window.location`. Returning the relative path lets the
  // `@better-auth/expo` client rewrite it into the app's deep-link scheme.
  if (typeof window !== 'undefined' && window.location !== undefined) {
    return `${window.location.origin}/sso-callback`;
  }
  return '/sso-callback';
}

function navigateIfRedirectUrl(res: SignInOauth2Result): void {
  const url = res.data?.url;
  if (typeof url !== 'string' || url.length === 0) return;
  // Native has no `window.location`; the `@better-auth/expo` client opens the
  // OAuth browser session itself, so this web-only redirect must be skipped.
  if (typeof window === 'undefined' || window.location === undefined) return;
  if (window.location.href === url) return;
  window.location.href = url;
}

/** Returns an async sign-in trigger that drives the dev IdP `genericOAuth` flow. */
export function useSignInWithDev(): () => Promise<void> {
  const authClient = useAuthClient();

  return useCallback(async () => {
    const callbackURL = resolveCallbackUrl();
    const client = authClient as unknown as {
      signIn: {
        oauth2: (args: {
          providerId: string;
          callbackURL: string;
        }) => Promise<SignInOauth2Result>;
      };
    };
    const res = await client.signIn.oauth2({
      providerId: DEV_PROVIDER,
      callbackURL,
    });
    if (res.error !== undefined && res.error !== null) {
      throw new Error(res.error.message ?? 'Dev sign-in failed');
    }
    navigateIfRedirectUrl(res);
  }, [authClient]);
}
