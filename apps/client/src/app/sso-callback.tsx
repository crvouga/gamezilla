import { useAuthClientPort } from '@libs/auth/client/auth-client-provider';
import { useAuthModals } from '@libs/auth/client/auth-modals-provider';
import { SIGN_IN_PENDING_KEY } from '@libs/auth/client/auth-storage-keys';
import {
  markSignInPending,
  useSignInPending,
} from '@libs/auth/client/sign-in-pending';
import { useSecureStorage } from '@pkgs/secure-storage/interface';
import { seedCachedSecureStorageValue } from '@pkgs/secure-storage/use-secure-storage-item';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useEffect, useLayoutEffect } from 'react';

/**
 * OAuth callback route (handoff only). Completes same-tab web return via
 * `completeHostedAuthRedirect`, ensures the durable sign-in pending marker,
 * opens SignInModal for loading/success/error, then replaces into the app so
 * chrome never lives on this dedicated screen.
 */
export default function SsoCallbackScreen() {
  const router = useRouter();
  const storage = useSecureStorage();
  const port = useAuthClientPort();
  const authState = port.useAuthSession();
  const { pending, isHydrated } = useSignInPending();
  const { openSignInModal } = useAuthModals();

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
    if (!authState.isHydrated) return;
    void (async () => {
      if (port.completeHostedAuthRedirect !== undefined) {
        await port.completeHostedAuthRedirect();
        return;
      }
      await port.ensureSessionReady?.();
    })();
  }, [port, authState.isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    if (pending !== null) return;
    const wire = JSON.stringify({
      startedAt: new Date().toISOString(),
      intent: 'signIn',
      baselineSessionIds: [],
    });
    seedCachedSecureStorageValue(SIGN_IN_PENDING_KEY, wire);
    void markSignInPending(storage, { intent: 'signIn' });
  }, [isHydrated, pending, storage]);

  useLayoutEffect(() => {
    if (!isHydrated) return;
    openSignInModal();
  }, [isHydrated, openSignInModal]);

  useEffect(() => {
    if (!isHydrated) return;
    if (pending === null) return;
    router.replace('/(tabs)');
  }, [isHydrated, pending, router]);

  return null;
}
