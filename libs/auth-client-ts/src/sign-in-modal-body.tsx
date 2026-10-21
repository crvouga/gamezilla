import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import type { OauthProviderId } from '@pkgs/auth-root-shared-ts/sign-in-method';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { ModalBody } from '@pkgs/ui-root-client-ts/modal-parts';
import { SocialSignInButton } from '@pkgs/ui-root-client-ts/social-sign-in-button';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { For, Show } from 'solid-js';
import { ContinueWithEmailButton } from './continue-with-email-button';
import { useSignInCapabilities } from './sign-in-capabilities-context';

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
  onContinueWithEmail: () => void;
}): JSX.Element {
  const capabilities = useSignInCapabilities();
  const methodsLoading = () => props.methodsLoading === true;
  const anyProvider = () => !methodsLoading() && props.providers.length > 0;
  // Email is the device's own capability: it never waits on synced config.
  const anyMethod = () => capabilities.email || anyProvider();

  return (
    <ModalBody>
      <StackVertical self="stretch" gap="sm" paddingTop="xs">
        <Show when={methodsLoading()}>
          <LoadingState caption={<Trans>Loading sign-in methods…</Trans>} />
        </Show>

        <Show when={anyMethod()}>
          <P variant="caption">
            <Trans>Choose a sign-in method</Trans>
          </P>
        </Show>

        <ContinueWithEmailButton onClick={props.onContinueWithEmail} />

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
          <P variant="caption">
            {props.signInUnavailableReason ?? (
              <Trans>Sign-in is not available.</Trans>
            )}
          </P>
        </Show>
      </StackVertical>
    </ModalBody>
  );
}
