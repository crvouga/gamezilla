/** @jsxImportSource solid-js */
import { useAuthClientPort } from '@libs/auth-client/auth-client-provider';
import {
  readSignInPendingSync,
  signInReturnHrefFromPending,
} from '@libs/auth-shared/sign-in-pending-parse';
import { Trans } from '@lingui/solid/macro';
import { useClock } from '@pkgs/clock-client/solid';
import { useRouter } from '@pkgs/ui-root-client/app-router';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import type { JSX } from 'solid-js';
import { onMount } from 'solid-js';

export default function SsoCallbackRoute(): JSX.Element {
  const router = useRouter();
  const port = useAuthClientPort();
  const clock = useClock();
  onMount(() => {
    const target = signInReturnHrefFromPending(
      readSignInPendingSync(() => clock.now())
    );
    void (port.completeHostedAuthRedirect?.() ?? Promise.resolve())
      // The auth session publishes failures for the resumed sign-in modal.
      .catch(() => undefined)
      .then(() => router.replace(target));
  });

  return (
    <div class="box items-center justify-center flex-1 bg-background">
      <LoadingState size="large" caption={<Trans>Signing in…</Trans>} />
    </div>
  );
}
