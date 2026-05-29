/**
 * Dev-only sign-in trigger that fires the Better Auth `genericOAuth` flow
 * for the in-repo {@link DEV_PROVIDER}. Mirrors {@link useSignIn} but calls
 * `signIn.oauth2({ providerId: 'dev', ... })`. Visible only when the API
 * origin is local (see {@link isLocalApiOrigin}); the server-side provider
 * is gated symmetrically, so the call is a no-op against production.
 */
import { useCallback, useMemo } from 'react';

import { DEV_PROVIDER } from '../shared/auth-entities';
import { authBaseUrl, useAuthClient } from './better-auth-client';
import { useConfigService } from './config-service-context';

type SignInOauth2Result = {
  error?: { message?: string } | null;
  data?: { url?: string; redirect?: boolean } | null;
};

function resolveCallbackUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/sso-callback`;
  }
  return '/sso-callback';
}

function navigateIfRedirectUrl(res: SignInOauth2Result): void {
  const url = res.data?.url;
  if (typeof url !== 'string' || url.length === 0) return;
  if (typeof window === 'undefined') return;
  if (window.location.href === url) return;
  window.location.href = url;
}

/** Returns an async sign-in trigger that drives the dev IdP `genericOAuth` flow. */
export function useSignInWithDev(): () => Promise<void> {
  const apiUrl = useConfigService().getApiUrl();
  const baseURL = useMemo(() => authBaseUrl(apiUrl), [apiUrl]);
  const authClient = useAuthClient(baseURL);

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
