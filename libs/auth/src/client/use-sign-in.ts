import { useCallback } from 'react';

import type { AuthClient } from './auth-client-provider';
import { useAuthClient } from './auth-client-provider';

type SignInSocialResult = {
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

function navigateIfRedirectUrl(
  res: Awaited<ReturnType<AuthClient['signIn']['social']>>
): void {
  const url = res.data?.url;
  if (typeof url !== 'string' || url.length === 0) return;
  // Native has no `window.location`; the `@better-auth/expo` client opens the
  // OAuth browser session itself, so this web-only redirect must be skipped.
  if (typeof window === 'undefined' || window.location === undefined) return;
  if (window.location.href === url) return;
  window.location.href = url;
}

/**
 * Triggers the Better Auth Google flow. Server-side provisioning + local
 * secure-storage writes happen inside `<AuthBridge />` once the session
 * snapshot rolls forward; this hook only fires the redirect.
 */
export function useSignIn(): () => Promise<void> {
  const authClient = useAuthClient();

  return useCallback(async () => {
    const callbackURL = resolveCallbackUrl();
    const res = (await authClient.signIn.social({
      provider: 'google',
      callbackURL,
    })) as unknown as SignInSocialResult;
    if (res.error !== undefined && res.error !== null) {
      throw new Error(res.error.message ?? 'Hosted sign-in failed');
    }
    navigateIfRedirectUrl(res);
  }, [authClient]);
}
