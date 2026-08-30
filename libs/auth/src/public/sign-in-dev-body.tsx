import { Handles } from '@libs/dst-handles';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import type { SignInCredentials } from '@pkgs/auth/shared/sign-in-strategy';
import { Box, Button, ModalBody, TextInput } from '@pkgs/ui';
import { type ReactNode, useState } from 'react';
import { setPendingSignupUsername } from './pending-signup-username';

export function SignInDevBody(props: {
  onSubmit: (credentials: SignInCredentials) => void;
}): ReactNode {
  const [subject, setSubject] = useState('');
  const trimmed = subject.trim();
  const canSubmit = trimmed.length > 0;

  return (
    <ModalBody>
      <Box sx={{ marginTop: 3, alignSelf: 'stretch', gap: 2 }}>
        <TextInput
          label={<Trans>Subject</Trans>}
          accessibilityLabel={t`Subject`}
          autoCapitalize="none"
          autoCorrect={false}
          value={subject}
          onChangeText={setSubject}
          placeholder={t`alice`}
          testID={Handles.authSubjectInput}
        />
        <Button
          title={<Trans>Continue</Trans>}
          intent="primary"
          disabled={!canSubmit}
          onPress={() => {
            setPendingSignupUsername(trimmed);
            props.onSubmit({ subject: trimmed, name: trimmed });
          }}
          testID={Handles.authSubmitDev}
        />
      </Box>
    </ModalBody>
  );
}
