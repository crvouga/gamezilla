import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useState } from 'react';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { Stack } from '../stack';
import { TextInput } from './text-input';

export default function TextInputExample() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  return (
    <ExampleRoot>
      <SchemePreview>
        <Stack spacing={3}>
          <TextInput
            label={<Trans>Name</Trans>}
            placeholder={t`John Doe`}
            value={name}
            onChangeText={setName}
            helperText={t`Your full name`}
          />

          <TextInput
            label={<Trans>Email</Trans>}
            placeholder={t`you@example.com`}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            label={<Trans>Error state</Trans>}
            placeholder={t`Type something…`}
            value=""
            error={t`This field is required`}
          />

          <TextInput
            label={<Trans>Disabled</Trans>}
            placeholder={t`Cannot edit`}
            value="Read-only value"
            editable={false}
          />
        </Stack>
      </SchemePreview>
    </ExampleRoot>
  );
}
