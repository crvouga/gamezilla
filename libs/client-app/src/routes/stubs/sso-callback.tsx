/** @jsxImportSource solid-js */
import { useAuthClientPort } from '@libs/auth/public/auth-client-provider';
import {
  readSignInPendingSync,
  signInReturnHrefFromPending,
} from '@libs/auth/public/sign-in-pending';
import { Trans } from '@lingui/solid/macro';
import { useClock, useTimers } from '@pkgs/clock/solid';
import { LoadingState, useRouter } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { onMount } from 'solid-js';
import {
  AUTH_POPUP_ACTIVE_KEY,
  AUTH_POPUP_CHANNEL,
  AUTH_POPUP_NAME,
  AUTH_POPUP_RESULT_KEY,
} from '../../shell/wall-open-auth-session';

const SSO_HANDOFF_NAVIGATE_MS = 800;

/** `window.opener` is `any` in lib.dom; the handoff only ever posts to it. */
type OpenerLike = {
  postMessage(message: unknown, targetOrigin: string): void;
};

function handoffToParent(): boolean {
  const opener = window.opener as OpenerLike | null;
  let markedActive = false;
  try {
    markedActive = window.localStorage.getItem(AUTH_POPUP_ACTIVE_KEY) === '1';
  } catch {
    // Storage may be unavailable; opener/name detection remains available.
  }
  const isPopup =
    opener !== null || window.name === AUTH_POPUP_NAME || markedActive;
  const message = { type: 'oauth-complete', url: window.location.href };
  try {
    window.localStorage.setItem(AUTH_POPUP_RESULT_KEY, window.location.href);
    window.localStorage.removeItem(AUTH_POPUP_ACTIVE_KEY);
  } catch {
    // Storage may be unavailable; message and polling remain available.
  }
  if (opener !== null) {
    opener.postMessage(message, window.location.origin);
  }
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(AUTH_POPUP_CHANNEL);
    channel.postMessage(message);
    channel.close();
  }
  if (isPopup) window.close();
  return isPopup;
}

function delay(
  ms: number,
  setTimeoutFn: (fn: () => void, delayMs: number) => unknown
): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeoutFn(resolve, ms);
  });
}

export default function SsoCallbackRoute(): JSX.Element {
  const router = useRouter();
  const port = useAuthClientPort();
  const clock = useClock();
  const timers = useTimers();
  onMount(() => {
    if (handoffToParent()) return;
    const settle = delay(SSO_HANDOFF_NAVIGATE_MS, timers.setTimeout)
      .then(() =>
        (port.completeHostedAuthRedirect ?? (() => Promise.resolve()))()
      )
      .catch(() => undefined);
    void settle.then(() => {
      const target = signInReturnHrefFromPending(
        readSignInPendingSync(() => clock.now())
      );
      router.replace(target);
    });
  });

  return (
    <div class="box items-center justify-center flex-1 bg-background">
      <LoadingState size="large" caption={<Trans>Signing in…</Trans>} />
    </div>
  );
}
