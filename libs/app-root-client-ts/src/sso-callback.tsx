/** @jsxImportSource solid-js */
import { useAuthClientPort } from '@libs/auth-client-ts/auth-client-provider';
import {
  readSignInPendingSync,
  signInReturnHrefFromPending,
} from '@libs/auth-shared-ts/sign-in-pending-parse';
import { Trans } from '@lingui/solid/macro';
import { useClock } from '@pkgs/clock-client-ts/solid';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
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
    <Surface tone="background" grow align="center" justify="center">
      <LoadingState size="lg" caption={<Trans>Signing in…</Trans>} />
    </Surface>
  );
}
