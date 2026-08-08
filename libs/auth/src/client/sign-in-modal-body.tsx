import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import {
  Box,
  Button,
  MailIcon,
  ModalBody,
  SocialSignInButton,
  Text,
} from '@pkgs/ui';

export function SignInModalBody(props: {
  googleAvailable: boolean;
  emailPasswordAvailable: boolean;
  signInUnavailableReason: string | null;
  onPressGoogle: () => void;
  onPressEmail: () => void;
}) {
  const {
    googleAvailable,
    emailPasswordAvailable,
    signInUnavailableReason,
    onPressGoogle,
    onPressEmail,
  } = props;
  const anyMethod = googleAvailable || emailPasswordAvailable;

  return (
    <ModalBody>
      <Box sx={{ marginTop: 3, alignSelf: 'stretch', gap: 2 }}>
        {anyMethod ? (
          <Text
            variant="caption"
            sx={{ color: 'textSecondary' }}
            label={<Trans>Choose a sign-in method</Trans>}
          />
        ) : null}

        {googleAvailable ? (
          <SocialSignInButton
            provider="google"
            action="signIn"
            theme={'light' as const}
            onPress={onPressGoogle}
          />
        ) : null}

        {emailPasswordAvailable ? (
          <Button
            title={<Trans>Sign in with email</Trans>}
            intent="neutral"
            variant="outline"
            startIcon={<MailIcon />}
            onPress={onPressEmail}
          />
        ) : null}

        {!anyMethod ? (
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
