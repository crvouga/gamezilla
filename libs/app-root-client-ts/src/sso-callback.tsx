/** @jsxImportSource solid-js */
import { useAuthClientPort } from '@libs/auth-client-ts/auth-client-provider';
import {
  readSignInPendingSync,
  signInReturnHrefFromPending,
} from '@libs/auth-shared-ts/sign-in-pending-parse';
import { useClock } from '@pkgs/clock-client-ts/solid';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import type { JSX } from 'solid-js';
import { onMount } from 'solid-js';
import { SsoCallbackScreenView } from './sso-callback-screen-view';

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

  return <SsoCallbackScreenView />;
}
