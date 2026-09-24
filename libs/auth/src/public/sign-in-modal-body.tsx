import { Handles } from '@libs/test-ids';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import type { OauthProviderId } from '@pkgs/auth/shared';
import { LoadingState, ModalBody, SocialSignInButton } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { For, Show } from 'solid-js';

/** The sign-in button test id for a provider. */
export function signInMethodTestId(provider: OauthProviderId): string {
  return provider === 'apple'
    ? Handles.authMethodApple
    : Handles.authMethodGoogle;
}

export function SignInModalBody(props: {
  methodsLoading?: boolean | undefined;
  /** Enabled sign-in methods, in display order. */
  providers: readonly OauthProviderId[];
  signInUnavailableReason: string | null;
  onPress: (provider: OauthProviderId) => void;
}): JSX.Element {
  const methodsLoading = () => props.methodsLoading === true;
  const anyMethod = () => props.providers.length > 0;

  return (
    <ModalBody>
      <div class="box mt-0.75 self-stretch gap-2">
        <Show when={methodsLoading()}>
          <LoadingState caption={<Trans>Loading sign-in methods…</Trans>} />
        </Show>

        <Show when={!methodsLoading() && anyMethod()}>
          <p class="text textCaption text-text-secondary">
            {<Trans>Choose a sign-in method</Trans>}
          </p>
        </Show>

        <Show when={!methodsLoading()}>
          <For each={props.providers}>
            {(provider) => (
              <SocialSignInButton
                provider={provider}
                action="signIn"
                theme={provider === 'apple' ? 'dark' : 'light'}
                onClick={() => props.onPress(provider)}
                dataSet={{ testid: signInMethodTestId(provider) }}
              />
            )}
          </For>
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
