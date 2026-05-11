import { Box, ModalBody, SocialSignInButton, Text } from '@gamezilla/ui';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

export function SignInModalBody(props: {
  signInAvailable: boolean;
  signInUnavailableReason: string | null;
  errorMessage: string | undefined;
  loading: boolean;
  onPressGoogle: () => void;
}) {
  const {
    signInAvailable,
    signInUnavailableReason,
    errorMessage,
    loading,
    onPressGoogle,
  } = props;
  return (
    <ModalBody>
      <Text
        variant="body"
        label={
          <Trans>
            Sign in to link this device to your server user. Your data stays
            local first.
          </Trans>
        }
      />
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
      </Box>
      {!signInAvailable ? (
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label={signInUnavailableReason ?? t`Sign-in is not available.`}
        />
      ) : null}
      {typeof errorMessage === 'string' && errorMessage.length > 0 ? (
        <Text variant="caption" sx={{ color: 'error' }} label={errorMessage} />
      ) : null}
    </ModalBody>
  );
}
