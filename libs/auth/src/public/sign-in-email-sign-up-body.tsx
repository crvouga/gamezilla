import { Trans } from '@lingui/react/macro';
import type { SignInCredentials } from '@pkgs/auth/shared/sign-in-strategy';
import { Box, ModalBody, Pressable, Text } from '@pkgs/ui';
import { useState } from 'react';
import { setPendingSignupUsername } from './pending-signup-username';
import { SignInEmailFields } from './sign-in-email-fields';

export function SignInEmailSignUpBody(props: {
  onSubmit: (credentials: SignInCredentials) => void;
  onGoToSignIn: () => void;
}) {
  const { onSubmit, onGoToSignIn } = props;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  return (
    <ModalBody>
      <Box sx={{ marginTop: 3, alignSelf: 'stretch', gap: 2 }}>
        <SignInEmailFields
          email={email}
          password={password}
          username={username}
          confirmPassword={confirmPassword}
          mode="sign-up"
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onUsernameChange={setUsername}
          onConfirmPasswordChange={setConfirmPassword}
          onSubmit={() => {
            setPendingSignupUsername(username);
            onSubmit({ email, password, mode: 'sign-up' });
          }}
          submitTitle={<Trans>Create account</Trans>}
        />
        <Pressable onPress={onGoToSignIn}>
          <Text
            variant="caption"
            sx={{ color: 'textSecondary' }}
            label={<Trans>Already have an account? Sign in</Trans>}
          />
        </Pressable>
      </Box>
    </ModalBody>
  );
}
