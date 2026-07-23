import { useAuthClientPort } from '@libs/auth/client/auth-client-provider';
import { useAuthModals } from '@libs/auth/client/auth-modals-provider';
import { SIGN_IN_PENDING_KEY } from '@libs/auth/client/auth-storage-keys';
import {
  clearSignInPending,
  markSignInPending,
  useSignInPending,
} from '@libs/auth/client/sign-in-pending';
import { isAuthSessionSignedIn } from '@libs/auth/client/session-snapshot';
import { useLingui } from '@lingui/react/macro';
import { useSecureStorage } from '@pkgs/secure-storage/interface';
import { seedCachedSecureStorageValue } from '@pkgs/secure-storage/use-secure-storage-item';
import { Box, LoadingState, SuccessState } from '@pkgs/ui';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect } from 'react';

/**
 * OAuth callback route. Same-tab web return completes via
 * `completeHostedAuthRedirect` — either `rotating_token_nonce` reload, or a
 * cookie-restored transferable/complete SignIn with no query params. Popup
 * AuthSession leftovers still call `maybeCompleteAuthSession`. The screen
 * watches the auth port session and resumes the sign-in modal when it settles.
 */
export default function SsoCallbackScreen() {
  const { t } = useLingui();
  const router = useRouter();
  const storage = useSecureStorage();
  const port = useAuthClientPort();
  const authState = port.useAuthSession();
  const { pending, isHydrated } = useSignInPending();
  const { openSignInModal, closeSignInModal } = useAuthModals();
  const sessionResolved = isAuthSessionSignedIn(authState);

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

  const dismissSuccess = useCallback(() => {
    void clearSignInPending(storage);
    closeSignInModal();
    router.replace('/(tabs)');
  }, [storage, closeSignInModal, router]);

  if (sessionResolved) {
    return (
      <Box sx={{ flex: 1, justifyContent: 'center', padding: 4 }}>
        <SuccessState
          title={t`Signed in`}
          body={t`You're signed in on this device.`}
          action={{ label: t`Done`, onPress: dismissSuccess }}
        />
      </Box>
    );
  }

  return <LoadingState size="large" caption={t`Signing in…`} />;
}
