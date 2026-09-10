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

const SSO_HANDOFF_NAVIGATE_MS = 800;

function delay(
  ms: number,
  setTimeoutFn: (fn: () => void, delayMs: number) => unknown
): Promise<void> {
  return new Promise((resolve) => {
    setTimeoutFn(resolve, ms);
  });
}

export default function SsoCallbackRoute(): JSX.Element {
  const router = useRouter();
  const port = useAuthClientPort();
  const clock = useClock();
  const timers = useTimers();

  onMount(() => {
    const settle = (
      port.completeHostedAuthRedirect ??
      port.ensureSessionReady ??
      (() => Promise.resolve(undefined))
    )().catch(() => undefined);
    void Promise.race([
      settle,
      delay(SSO_HANDOFF_NAVIGATE_MS, timers.setTimeout),
    ]).then(async () => {
      const target = signInReturnHrefFromPending(
        readSignInPendingSync(() => clock.now())
      );
      router.replace(target);
      await settle;
    });
  });

  return (
    <div class="box items-center justify-center flex-1 bg-background">
      <LoadingState size="large" caption={<Trans>Signing in…</Trans>} />
    </div>
  );
}
