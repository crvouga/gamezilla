import { t } from '@lingui/core/macro';
import { Trans } from '@gamezilla/lib/i18n';
import { useState } from 'react';
import { Box } from '../box';
import { Text } from '../text';
import { TextInput } from './text-input';

export default function TextInputExample() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label={<Trans>TextInput</Trans>} />

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
        placeholder={t`Type something...`}
        value=""
        error={t`This field is required`}
      />

      <TextInput
        label={<Trans>Disabled</Trans>}
        placeholder={t`Cannot edit`}
        value="Read-only value"
        editable={false}
      />
    </Box>
  );
}
