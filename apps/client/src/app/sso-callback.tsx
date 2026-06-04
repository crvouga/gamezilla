import { useAuthClient } from '@libs/auth/client/auth-client-provider';
import { useAuthModals } from '@libs/auth/client/auth-modals-provider';
import { SIGN_IN_PENDING_KEY } from '@libs/auth/client/auth-storage-keys';
import {
  clearSignInPending,
  markSignInPending,
  useSignInPending,
} from '@libs/auth/client/sign-in-pending';
import { assert } from '@pkgs/assert';
import { useSecureStorage } from '@pkgs/secure-storage/interface';
import { seedCachedSecureStorageValue } from '@pkgs/secure-storage/use-secure-storage-item';
import { Box, LoadingState, SuccessState } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

const SESSION_POLL_MS = 500;

function isGetSessionSignedIn(data: unknown): boolean {
  if (data === null || data === undefined || typeof data !== 'object') {
    return false;
  }
  const record = data as { user?: unknown; session?: unknown };
  const hasUser = record.user !== null && record.user !== undefined;
  const hasSession = record.session !== null && record.session !== undefined;
  return hasUser || hasSession;
}

/**
 * Web OAuth callback route. `WebBrowser.maybeCompleteAuthSession()` in
 * `polyfill-entry` completes the Better Auth handoff; we invoke it again here
 * so a cold load on this route cannot miss the handoff.
 */
export default function SsoCallbackScreen() {
  const { t } = useLingui();
  const router = useRouter();
  const storage = useSecureStorage();
  const authClient = useAuthClient();
  const { pending, isHydrated } = useSignInPending();
  const { openSignInModal, closeSignInModal } = useAuthModals();
  const [sessionResolved, setSessionResolved] = useState(false);

  assert.ok(
    typeof authClient.getSession === 'function',
    'auth client must expose getSession for OAuth callback refresh'
  );
  assert.ok(
    typeof WebBrowser.maybeCompleteAuthSession === 'function',
    'expo-web-browser must expose maybeCompleteAuthSession'
  );

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const poll = async (): Promise<void> => {
      const res = await authClient.getSession();
      if (cancelled) return;
      if (isGetSessionSignedIn(res.data)) {
        setSessionResolved(true);
      }
    };
    void poll();
    const id = setInterval(() => {
      void poll();
    }, SESSION_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [authClient]);

  useEffect(() => {
    if (!isHydrated) return;
    if (pending !== null) return;
    const started = new Date().toISOString();
    seedCachedSecureStorageValue(SIGN_IN_PENDING_KEY, started);
    void markSignInPending(storage);
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

  if (sessionResolved && isHydrated) {
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
