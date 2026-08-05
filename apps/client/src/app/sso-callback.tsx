import { useAuthClientPort } from '@libs/auth/client/auth-client-provider';
import { useAuthModals } from '@libs/auth/client/auth-modals-provider';
import { SIGN_IN_PENDING_KEY } from '@libs/auth/client/auth-storage-keys';
import {
  markSignInPending,
  readSignInPendingSync,
  signInReturnHrefFromPending,
} from '@libs/auth/client/sign-in-pending';
import { useSecureStorage } from '@pkgs/secure-storage/interface';
import { seedCachedSecureStorageValue } from '@pkgs/secure-storage/use-secure-storage-item';
import * as WebBrowser from 'expo-web-browser';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * OAuth callback route (handoff only). Completes same-tab web return via
 * `completeHostedAuthRedirect`, opens SignInModal, then immediately replaces
 * back to the pre-OAuth screen. Navigation must not wait on async secure-storage
 * hydration — that can stall and leave this blank route mounted forever.
 */
export default function SsoCallbackScreen() {
  const router = useRouter();
  const storage = useSecureStorage();
  const port = useAuthClientPort();
  const authState = port.useAuthSession();
  const { openSignInModal } = useAuthModals();
  const didNavigateRef = useRef(false);

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

  useLayoutEffect(() => {
    if (didNavigateRef.current) return;
    didNavigateRef.current = true;

    const syncPending = readSignInPendingSync();
    const target = signInReturnHrefFromPending(syncPending);

    // Keep the reactive pending hook / modal resume path warm even if async
    // hydrate is stalled.
    const wire =
      syncPending === null
        ? JSON.stringify({
            startedAt: new Date().toISOString(),
          })
        : JSON.stringify({
            startedAt: syncPending.startedAt.toISOString(),
            ...(syncPending.returnHref !== undefined
              ? { returnHref: syncPending.returnHref }
              : {}),
          });
    seedCachedSecureStorageValue(SIGN_IN_PENDING_KEY, wire);
    if (syncPending === null) {
      void markSignInPending(storage);
    }

    openSignInModal();
    router.replace(target as Href);
  }, [router, openSignInModal, storage]);

  return null;
}
