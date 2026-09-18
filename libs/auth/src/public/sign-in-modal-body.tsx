import { Handles } from '@libs/test-ids';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { LoadingState, ModalBody, SocialSignInButton } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

export function SignInModalBody(props: {
  methodsLoading?: boolean | undefined;
  googleAvailable: boolean;
  signInUnavailableReason: string | null;
  onPressGoogle: () => void;
}): JSX.Element {
  const methodsLoading = () => props.methodsLoading === true;
  const anyMethod = () => props.googleAvailable;

  return (
    <ModalBody>
      <div class="box mt-[3px] self-stretch gap-2">
        <Show when={methodsLoading()}>
          <LoadingState caption={<Trans>Loading sign-in methods…</Trans>} />
        </Show>

        <Show when={!methodsLoading() && anyMethod()}>
          <p class="text textCaption text-text-secondary">
            {<Trans>Choose a sign-in method</Trans>}
          </p>
        </Show>

        <Show when={!methodsLoading() && props.googleAvailable}>
          <SocialSignInButton
            provider="google"
            action="signIn"
            theme="light"
            onClick={() => props.onPressGoogle()}
            dataSet={{ testid: Handles.authMethodGoogle }}
          />
        </Show>

        <Show when={!methodsLoading() && !anyMethod()}>
          <p class="text textCaption text-text-secondary">
            {props.signInUnavailableReason ?? t`Sign-in is not available.`}
          </p>
        </Show>
      </div>
    </ModalBody>
  );
}
