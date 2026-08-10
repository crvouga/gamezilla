import { Trans } from '@lingui/react/macro';
import type { SignInCredentials } from '@pkgs/auth/shared/sign-in-strategy';
import { Box, ModalBody, Text } from '@pkgs/ui';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { SignInEmailFields } from './sign-in-email-fields';

export function SignInEmailSignInBody(props: {
  onSubmit: (credentials: SignInCredentials) => void;
  onGoToSignUp: () => void;
}) {
  const { onSubmit, onGoToSignUp } = props;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <ModalBody>
      <Box sx={{ marginTop: 3, alignSelf: 'stretch', gap: 2 }}>
        <SignInEmailFields
          email={email}
          password={password}
          mode="sign-in"
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onSubmit={() => {
            onSubmit({ email, password, mode: 'sign-in' });
          }}
          submitTitle={<Trans>Sign in</Trans>}
        />
        <Pressable onPress={onGoToSignUp}>
          <Text
            variant="caption"
            sx={{ color: 'textSecondary' }}
            label={<Trans>Need an account? Create one</Trans>}
          />
        </Pressable>
      </Box>
    </ModalBody>
  );
}
