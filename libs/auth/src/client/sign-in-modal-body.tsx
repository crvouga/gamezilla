import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Box, ModalBody, SocialSignInButton, Text } from '@pkgs/ui';

export function SignInModalBody(props: {
  signInAvailable: boolean;
  signInUnavailableReason: string | null;
  onPressGoogle: () => void;
}) {
  const { signInAvailable, signInUnavailableReason, onPressGoogle } = props;
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
    </ModalBody>
  );
}
