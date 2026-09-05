import {
  type AuthClientPort,
  useAuthClientPort,
} from '@libs/auth/public/auth-client-provider';
import { useAuthModals } from '@libs/auth/public/auth-modals-provider';
import { SIGN_IN_PENDING_KEY } from '@libs/auth/public/auth-storage-keys';
import {
  readSignInPendingSync,
  SignInPendingStore,
  signInReturnHrefFromPending,
} from '@libs/auth/public/sign-in-pending';
import { useLingui } from '@lingui/react/macro';
import { useClock, useTimers } from '@pkgs/clock';
import type { SecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import {
  useSecureStorageStore,
  writeSecureStorageItem,
} from '@pkgs/secure-storage/use-secure-storage-item';
import { Center, type Href, LoadingState, useRouter } from '@pkgs/ui';
import * as WebBrowser from 'expo-web-browser';
import { type ReactNode, useEffect, useRef } from 'react';

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
    void new SignInPendingStore(store).mark(() => nowMs);
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

/**
 * Popup returns: `maybeCompleteAuthSession` succeeds and the parent
 * `openAuthSessionAsync` exchanges the one-shot code — do not exchange again.
 * Same-tab / native: completion is `failed` (or no-op), so exchange here.
 */
function shouldExchangeOnCallbackPage(): boolean {
  const result = WebBrowser.maybeCompleteAuthSession();
  return result.type !== 'success';
}

async function completeSsoCallbackAndNavigate(args: {
  readonly store: SecureStorageStore;
  readonly port: AuthClientPort;
  readonly openSignInModal: () => void;
  readonly replace: (href: Href) => void;
  readonly nowMs: number;
  readonly now: () => number;
  readonly setTimeout: (fn: () => void, ms: number) => unknown;
  readonly exchangeOnPage: boolean;
}): Promise<void> {
  writePendingMarker(args.store, args.nowMs, args.now);
  args.openSignInModal();
  const settle = args.exchangeOnPage
    ? finishHostedAuthRedirect(args.port).catch(() => undefined)
    : Promise.resolve();
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
  const router = useRouter();
  const store = useSecureStorageStore();
  const port = useAuthClientPort();
  const { openSignInModal } = useAuthModals();
  const clock = useClock();
  const timers = useTimers();
  const didFinishRef = useRef(false);

  useEffect(() => {
    if (didFinishRef.current) return;
    didFinishRef.current = true;
    const exchangeOnPage = shouldExchangeOnCallbackPage();
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
      exchangeOnPage,
    });
  }, [clock, openSignInModal, port, router, store, timers]);

  return (
    <Center sx={{ flex: 1, background: 'background' }}>
      <LoadingState size="large" caption={t`Signing in…`} />
    </Center>
  );
}
