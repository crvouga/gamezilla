import { useCallback } from 'react';
import { Platform } from 'react-native';

import type { AuthClient } from './auth-client-provider';
import { useAuthClient } from './auth-client-provider';
import { resolveOAuthCallbackUrl } from './resolve-oauth-callback-url';
import type { SignInTriggerResult } from './sign-in-trigger';

type SignInSocialResult = {
  error?: { message?: string } | null;
  data?: { url?: string; redirect?: boolean } | null;
};

function navigateIfRedirectUrl(
  res: Awaited<ReturnType<AuthClient['signIn']['social']>>
): SignInTriggerResult {
  const url = res.data?.url;
  if (typeof url !== 'string' || url.length === 0) return 'completed';
  // Native: `@better-auth/expo` opens the OAuth browser session itself.
  if (Platform.OS !== 'web') return 'completed';
  if (window.location.href === url) return 'completed';
  window.location.href = url;
  return 'redirecting';
}

/**
 * Triggers the Better Auth Google flow. Server-side provisioning + local
 * secure-storage writes happen inside `<AuthBridge />` once the session
 * snapshot rolls forward; this hook only fires the redirect. Returns whether
 * the page is redirecting away (web) or the flow already completed (native).
 */
export function useSignIn(): () => Promise<SignInTriggerResult> {
  const authClient = useAuthClient();

  return useCallback(async () => {
    const callbackURL = resolveOAuthCallbackUrl();
    const res = (await authClient.signIn.social({
      provider: 'google',
      callbackURL,
    })) as unknown as SignInSocialResult;
    if (res.error !== undefined && res.error !== null) {
      throw new Error(res.error.message ?? 'Hosted sign-in failed');
    }
    return navigateIfRedirectUrl(res);
  }, [authClient]);
}
