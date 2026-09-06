import { Handles } from '@libs/test-ids';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import {
  Box,
  LoadingState,
  ModalBody,
  SocialSignInButton,
  Text,
} from '@pkgs/ui-rn';

export function SignInModalBody(props: {
  methodsLoading?: boolean;
  googleAvailable: boolean;
  devOauthAvailable: boolean;
  signInUnavailableReason: string | null;
  onPressGoogle: () => void;
  onPressDev: () => void;
}) {
  const {
    methodsLoading = false,
    googleAvailable,
    devOauthAvailable,
    signInUnavailableReason,
    onPressGoogle,
    onPressDev,
  } = props;
  const anyMethod = googleAvailable || devOauthAvailable;

  return (
    <ModalBody>
      <Box sx={{ marginTop: 3, alignSelf: 'stretch', gap: 2 }}>
        {methodsLoading ? (
          <LoadingState caption={<Trans>Loading sign-in methods…</Trans>} />
        ) : null}

        {!methodsLoading && anyMethod ? (
          <Text
            variant="caption"
            sx={{ color: 'textSecondary' }}
            label={<Trans>Choose a sign-in method</Trans>}
          />
        ) : null}

        {!methodsLoading && googleAvailable ? (
          <SocialSignInButton
            provider="google"
            action="signIn"
            theme={'light' as const}
            onPress={onPressGoogle}
          />
        ) : null}

        {!methodsLoading && devOauthAvailable ? (
          <SocialSignInButton
            provider="dev"
            action="signIn"
            theme={'neutral' as const}
            onPress={onPressDev}
            testID={Handles.authMethodDev}
          />
        ) : null}

        {!methodsLoading && !anyMethod ? (
          <Text
            variant="caption"
            sx={{ color: 'textSecondary' }}
            label={signInUnavailableReason ?? t`Sign-in is not available.`}
          />
        ) : null}
      </Box>
    </ModalBody>
  );
}
