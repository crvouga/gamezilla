import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Box, Button, TextInput } from '@pkgs/ui';
import type { ReactNode } from 'react';

export function SignInEmailFields(props: {
  email: string;
  password: string;
  mode: 'sign-in' | 'sign-up';
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  submitTitle: ReactNode;
}) {
  const {
    email,
    password,
    mode,
    onEmailChange,
    onPasswordChange,
    onSubmit,
    submitTitle,
  } = props;
  const canSubmit = email.trim().length > 0 && password.length > 0;

  return (
    <Box sx={{ alignSelf: 'stretch', gap: 2 }}>
      <TextInput
        label={<Trans>Email</Trans>}
        accessibilityLabel={t`Email`}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        value={email}
        onChangeText={onEmailChange}
        placeholder={t`you@example.com`}
      />
      <TextInput
        label={<Trans>Password</Trans>}
        accessibilityLabel={t`Password`}
        secureTextEntry
        textContentType={mode === 'sign-up' ? 'newPassword' : 'password'}
        value={password}
        onChangeText={onPasswordChange}
        placeholder={t`Password`}
      />
      <Button title={submitTitle} onPress={onSubmit} disabled={!canSubmit} />
    </Box>
  );
}
