import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Box, ErrorState, ModalBody, SocialSignInButton, Text } from '@pkgs/ui';

export function SignInModalBody(props: {
  signInAvailable: boolean;
  signInUnavailableReason: string | null;
  errorMessage: string | undefined;
  loading: boolean;
  /** When true, show the dev-only "Continue with test account" button. */
  devSignInAvailable: boolean;
  onPressGoogle: () => void;
  onPressDev: () => void;
}) {
  const {
    signInAvailable,
    signInUnavailableReason,
    errorMessage,
    loading,
    devSignInAvailable,
    onPressGoogle,
    onPressDev,
  } = props;
  return (
    <ModalBody>
      <Box sx={{ marginTop: 3, alignSelf: 'stretch', gap: 2 }}>
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label={<Trans>Choose a sign-in method</Trans>}
        />
        <SocialSignInButton
          provider="google"
          action="signIn"
          theme={'light' as const}
          onPress={onPressGoogle}
          loading={loading && signInAvailable}
          disabled={!signInAvailable}
        />
        {devSignInAvailable ? (
          <SocialSignInButton
            provider="dev"
            action="signIn"
            theme={'light' as const}
            onPress={onPressDev}
            loading={loading && signInAvailable}
            disabled={!signInAvailable}
          />
        ) : null}
      </Box>
      {!signInAvailable ? (
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label={signInUnavailableReason ?? t`Sign-in is not available.`}
        />
      ) : null}
      {typeof errorMessage === 'string' && errorMessage.length > 0 ? (
        <ErrorState
          variant="compact"
          title={t`Sign-in failed`}
          body={errorMessage}
        />
      ) : null}
    </ModalBody>
  );
}
