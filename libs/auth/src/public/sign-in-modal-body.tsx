import { Handles } from '@libs/test-ids';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import {
  Box,
  LoadingState,
  ModalBody,
  SocialSignInButton,
  Text,
} from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

export function SignInModalBody(props: {
  methodsLoading?: boolean | undefined;
  googleAvailable: boolean;
  devOauthAvailable: boolean;
  signInUnavailableReason: string | null;
  onPressGoogle: () => void;
  onPressDev: () => void;
}): JSX.Element {
  const methodsLoading = () => props.methodsLoading === true;
  const anyMethod = () => props.googleAvailable || props.devOauthAvailable;

  return (
    <ModalBody>
      <Box sx={{ marginTop: 3, alignSelf: 'stretch', gap: 2 }}>
        <Show when={methodsLoading()}>
          <LoadingState caption={<Trans>Loading sign-in methods…</Trans>} />
        </Show>

        <Show when={!methodsLoading() && anyMethod()}>
          <Text
            variant="caption"
            sx={{ color: 'textSecondary' }}
            label={<Trans>Choose a sign-in method</Trans>}
          />
        </Show>

        <Show when={!methodsLoading() && props.googleAvailable}>
          <SocialSignInButton
            provider="google"
            action="signIn"
            theme="light"
            onClick={() => props.onPressGoogle()}
          />
        </Show>

        <Show when={!methodsLoading() && props.devOauthAvailable}>
          <SocialSignInButton
            provider="dev"
            action="signIn"
            theme="neutral"
            onClick={() => props.onPressDev()}
            dataSet={{ testid: Handles.authMethodDev }}
          />
        </Show>

        <Show when={!methodsLoading() && !anyMethod()}>
          <Text
            variant="caption"
            sx={{ color: 'textSecondary' }}
            label={
              props.signInUnavailableReason ?? t`Sign-in is not available.`
            }
          />
        </Show>
      </Box>
    </ModalBody>
  );
}
