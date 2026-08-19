import { Handles } from '@libs/dst-handles';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Box, Button, TextInput } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { isValidSignupUsername } from './signup-username';

function EmailField(props: {
  email: string;
  onEmailChange: (value: string) => void;
}): ReactNode {
  return (
    <TextInput
      label={<Trans>Email</Trans>}
      accessibilityLabel={t`Email`}
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType="email-address"
      textContentType="emailAddress"
      value={props.email}
      onChangeText={props.onEmailChange}
      placeholder={t`you@example.com`}
      testID={Handles.authEmailInput}
    />
  );
}

function PasswordField(props: {
  password: string;
  mode: 'sign-in' | 'sign-up';
  onPasswordChange: (value: string) => void;
}): ReactNode {
  return (
    <TextInput
      label={<Trans>Password</Trans>}
      accessibilityLabel={t`Password`}
      secureTextEntry
      textContentType={props.mode === 'sign-up' ? 'newPassword' : 'password'}
      value={props.password}
      onChangeText={props.onPasswordChange}
      placeholder={t`Password`}
      testID={Handles.authPasswordInput}
    />
  );
}

function UsernameField(props: {
  username: string;
  onUsernameChange: (value: string) => void;
}): ReactNode {
  return (
    <TextInput
      label={<Trans>Username</Trans>}
      accessibilityLabel={t`Username`}
      autoCapitalize="none"
      autoCorrect={false}
      value={props.username}
      onChangeText={props.onUsernameChange}
      placeholder={t`your_handle`}
      testID={Handles.authUsernameInput}
    />
  );
}

function ConfirmPasswordField(props: {
  confirmPassword: string;
  onConfirmPasswordChange: (value: string) => void;
}): ReactNode {
  return (
    <TextInput
      label={<Trans>Confirm password</Trans>}
      accessibilityLabel={t`Confirm password`}
      secureTextEntry
      textContentType="newPassword"
      value={props.confirmPassword}
      onChangeText={props.onConfirmPasswordChange}
      placeholder={t`Confirm password`}
      testID={Handles.authConfirmPasswordInput}
    />
  );
}

function canSubmitEmailFields(args: {
  email: string;
  password: string;
  mode: 'sign-in' | 'sign-up';
  username?: string;
  confirmPassword?: string;
}): boolean {
  if (args.email.trim().length === 0 || args.password.length === 0) {
    return false;
  }
  if (args.mode === 'sign-in') return true;
  if (args.username === undefined || args.confirmPassword === undefined) {
    return false;
  }
  return (
    isValidSignupUsername(args.username) &&
    args.confirmPassword === args.password
  );
}

function SignUpUsernameSlot(props: {
  username: string | undefined;
  onUsernameChange: ((value: string) => void) | undefined;
}): ReactNode {
  if (props.username === undefined || props.onUsernameChange === undefined) {
    return null;
  }
  return (
    <UsernameField
      username={props.username}
      onUsernameChange={props.onUsernameChange}
    />
  );
}

function SignUpConfirmSlot(props: {
  confirmPassword: string | undefined;
  onConfirmPasswordChange: ((value: string) => void) | undefined;
}): ReactNode {
  if (
    props.confirmPassword === undefined ||
    props.onConfirmPasswordChange === undefined
  ) {
    return null;
  }
  return (
    <ConfirmPasswordField
      confirmPassword={props.confirmPassword}
      onConfirmPasswordChange={props.onConfirmPasswordChange}
    />
  );
}

export function SignInEmailFields(props: {
  email: string;
  password: string;
  mode: 'sign-in' | 'sign-up';
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  submitTitle: ReactNode;
  username?: string;
  confirmPassword?: string;
  onUsernameChange?: (value: string) => void;
  onConfirmPasswordChange?: (value: string) => void;
}) {
  const canSubmit = canSubmitEmailFields(props);
  const showSignUpExtras =
    props.mode === 'sign-up' &&
    props.username !== undefined &&
    props.confirmPassword !== undefined &&
    props.onUsernameChange !== undefined &&
    props.onConfirmPasswordChange !== undefined;

  return (
    <Box sx={{ alignSelf: 'stretch', gap: 2 }}>
      {showSignUpExtras ? (
        <SignUpUsernameSlot
          username={props.username}
          onUsernameChange={props.onUsernameChange}
        />
      ) : null}
      <EmailField email={props.email} onEmailChange={props.onEmailChange} />
      <PasswordField
        password={props.password}
        mode={props.mode}
        onPasswordChange={props.onPasswordChange}
      />
      {showSignUpExtras ? (
        <SignUpConfirmSlot
          confirmPassword={props.confirmPassword}
          onConfirmPasswordChange={props.onConfirmPasswordChange}
        />
      ) : null}
      <Button
        title={props.submitTitle}
        onPress={props.onSubmit}
        disabled={!canSubmit}
        {...(props.mode === 'sign-up'
          ? { testID: Handles.authSubmitCreate }
          : {})}
      />
    </Box>
  );
}
