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
import { useClock, useTimers } from '@pkgs/clock';
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

function writePendingMarker(
  store: SecureStorageStore,
  nowMs: number,
  now: () => number
): void {
  const syncPending = readSignInPendingSync(now);
  const wire =
    syncPending === null
      ? JSON.stringify({ startedAt: new Date(nowMs).toISOString() })
      : JSON.stringify({
          startedAt: syncPending.startedAt.toISOString(),
          ...(syncPending.returnHref !== undefined
            ? { returnHref: syncPending.returnHref }
            : {}),
        });
  store.setValue(SIGN_IN_PENDING_KEY, wire);
  if (syncPending === null) {
    void markSignInPending(store, () => nowMs);
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

function delay(
  ms: number,
  setTimeoutFn: (fn: () => void, delayMs: number) => unknown
): Promise<void> {
  return new Promise((resolve) => {
    setTimeoutFn(resolve, ms);
  });
}

async function completeSsoCallbackAndNavigate(args: {
  readonly store: SecureStorageStore;
  readonly port: AuthClientPort;
  readonly openSignInModal: () => void;
  readonly replace: (href: Href) => void;
  readonly nowMs: number;
  readonly now: () => number;
  readonly setTimeout: (fn: () => void, ms: number) => unknown;
}): Promise<void> {
  writePendingMarker(args.store, args.nowMs, args.now);
  args.openSignInModal();
  // Better Auth already set the session cookie on the API during Google return.
  // Settle bearer in parallel; don't block leaving `/sso-callback` on a slow
  // get-session (wrangler often takes multiple seconds per call).
  const settle = finishHostedAuthRedirect(args.port).catch(() => undefined);
  await Promise.race([settle, delay(SSO_HANDOFF_NAVIGATE_MS, args.setTimeout)]);
  const target = signInReturnHrefFromPending(readSignInPendingSync(args.now));
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
  const clock = useClock();
  const timers = useTimers();
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
      nowMs: clock.now(),
      now: clock.now,
      setTimeout: timers.setTimeout,
    });
  }, [clock, openSignInModal, port, router, store, timers]);

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
