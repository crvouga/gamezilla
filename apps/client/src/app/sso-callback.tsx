import { useAuthClientPort } from '@libs/auth/client/auth-client-provider';
import { useAuthModals } from '@libs/auth/client/auth-modals-provider';
import { SIGN_IN_PENDING_KEY } from '@libs/auth/client/auth-storage-keys';
import {
  markSignInPending,
  readSignInPendingSync,
  signInReturnHrefFromPending,
} from '@libs/auth/client/sign-in-pending';
import type { AuthClientPort } from '@pkgs/auth/client/auth-client-port';
import type { SecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import {
  useSecureStorageStore,
  writeSecureStorageItem,
} from '@pkgs/secure-storage/use-secure-storage-item';
import { type Href, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef } from 'react';

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

async function completeSsoCallbackAndNavigate(args: {
  readonly store: SecureStorageStore;
  readonly port: AuthClientPort;
  readonly openSignInModal: () => void;
  readonly replace: (href: Href) => void;
}): Promise<void> {
  writePendingMarker(args.store);
  args.openSignInModal();
  try {
    await finishHostedAuthRedirect(args.port);
  } catch {
    // Modal resume path surfaces cancel/error once auth settles signed-out.
  }
  const target = signInReturnHrefFromPending(readSignInPendingSync());
  args.replace(target as Href);
}

/**
 * OAuth callback route (handoff only). Must finish `completeHostedAuthRedirect`
 * **before** `router.replace` — navigating first strips `rotating_token_nonce`
 * from the URL and leaves SignInModal stuck on "Signing in…".
 */
export default function SsoCallbackScreen() {
  const router = useRouter();
  const store = useSecureStorageStore();
  const port = useAuthClientPort();
  const authState = port.useAuthSession();
  const { openSignInModal } = useAuthModals();
  const didFinishRef = useRef(false);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  useEffect(() => {
    if (didFinishRef.current) return;
    if (!authState.isHydrated) return;
    didFinishRef.current = true;
    void completeSsoCallbackAndNavigate({
      store,
      port,
      openSignInModal,
      replace: (href) => {
        router.replace(href);
      },
    });
  }, [authState.isHydrated, openSignInModal, port, router, store]);

  return null;
}
