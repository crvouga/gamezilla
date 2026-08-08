import {
  type AuthClientPort,
  useAuthClientPort,
} from '@libs/auth/client/auth-client-provider';
import { useAuthModals } from '@libs/auth/client/auth-modals-provider';
import { SIGN_IN_PENDING_KEY } from '@libs/auth/client/auth-storage-keys';
import {
  markSignInPending,
  readSignInPendingSync,
  signInReturnHrefFromPending,
} from '@libs/auth/client/sign-in-pending';
import { useLingui } from '@lingui/react/macro';
import type { SecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import {
  useSecureStorageStore,
  writeSecureStorageItem,
} from '@pkgs/secure-storage/use-secure-storage-item';
import { LoadingState, useTheme } from '@pkgs/ui';
import { type Href, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { type ReactNode, useEffect, useRef } from 'react';
import { View } from 'react-native';

/** Cap wait for bearer capture so the blank callback route never sticks. */
const SSO_HANDOFF_NAVIGATE_MS = 800;

function writePendingMarker(store: SecureStorageStore): void {
  const syncPending = readSignInPendingSync();
  const wire =
    syncPending === null
      ? JSON.stringify({ startedAt: new Date().toISOString() })
      : JSON.stringify({
          startedAt: syncPending.startedAt.toISOString(),
          ...(syncPending.returnHref !== undefined
            ? { returnHref: syncPending.returnHref }
            : {}),
        });
  store.setValue(SIGN_IN_PENDING_KEY, wire);
  if (syncPending === null) {
    void markSignInPending(store);
  } else {
    void writeSecureStorageItem(store, SIGN_IN_PENDING_KEY, wire);
  }
}

async function finishHostedAuthRedirect(port: AuthClientPort): Promise<void> {
  if (port.completeHostedAuthRedirect !== undefined) {
    await port.completeHostedAuthRedirect();
    return;
  }
  await port.ensureSessionReady?.();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function completeSsoCallbackAndNavigate(args: {
  readonly store: SecureStorageStore;
  readonly port: AuthClientPort;
  readonly openSignInModal: () => void;
  readonly replace: (href: Href) => void;
}): Promise<void> {
  writePendingMarker(args.store);
  args.openSignInModal();
  // Better Auth already set the session cookie on the API during Google return.
  // Settle bearer in parallel; don't block leaving `/sso-callback` on a slow
  // get-session (wrangler often takes multiple seconds per call).
  const settle = finishHostedAuthRedirect(args.port).catch(() => undefined);
  await Promise.race([settle, delay(SSO_HANDOFF_NAVIGATE_MS)]);
  const target = signInReturnHrefFromPending(readSignInPendingSync());
  args.replace(target as Href);
  await settle;
}

/**
 * OAuth callback route (handoff only). Shows an immediate loading state, then
 * leaves for the return href while SignInModal resume finishes session UX.
 */
export default function SsoCallbackScreen(): ReactNode {
  const { t } = useLingui();
  const theme = useTheme();
  const router = useRouter();
  const store = useSecureStorageStore();
  const port = useAuthClientPort();
  const { openSignInModal } = useAuthModals();
  const didFinishRef = useRef(false);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  useEffect(() => {
    if (didFinishRef.current) return;
    didFinishRef.current = true;
    void completeSsoCallbackAndNavigate({
      store,
      port,
      openSignInModal,
      replace: (href) => {
        router.replace(href);
      },
    });
  }, [openSignInModal, port, router, store]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <LoadingState size="large" caption={t`Signing in…`} />
    </View>
  );
}
