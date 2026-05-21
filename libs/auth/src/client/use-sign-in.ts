import { useCallback, useMemo } from 'react';

import type { AuthClient } from './better-auth-client';
import { authBaseUrl, useAuthClient } from './better-auth-client';
import { useConfigService } from './config-service-context';

type SignInSocialResult = {
  error?: { message?: string } | null;
  data?: { url?: string; redirect?: boolean } | null;
};

function resolveCallbackUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/sso-callback`;
  }
  return '/sso-callback';
}

function navigateIfRedirectUrl(
  res: Awaited<ReturnType<AuthClient['signIn']['social']>>
): void {
  const url = res.data?.url;
  if (typeof url !== 'string' || url.length === 0) return;
  if (typeof window === 'undefined') return;
  if (window.location.href === url) return;
  window.location.href = url;
}

/**
 * Triggers the Better Auth Google flow. Server-side provisioning + local
 * secure-storage writes happen inside `<AuthBridge />` once the session
 * snapshot rolls forward; this hook only fires the redirect.
 */
export function useSignIn(): () => Promise<void> {
  const apiUrl = useConfigService().getApiUrl();
  const baseURL = useMemo(() => authBaseUrl(apiUrl), [apiUrl]);
  const authClient = useAuthClient(baseURL);

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
