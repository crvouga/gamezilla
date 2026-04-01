import { useState } from 'react';
import { Box } from '../box';
import { Text } from '../text';
import { TextInput } from './text-input';

export default function TextInputExample() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading">TextInput</Text>

      <TextInput
        label="Name"
        placeholder="John Doe"
        value={name}
        onChangeText={setName}
        helperText="Your full name"
      />

      <TextInput
        label="Email"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        label="Error state"
        placeholder="Type something..."
        value=""
        error="This field is required"
      />

      <TextInput
        label="Disabled"
        placeholder="Cannot edit"
        value="Read-only value"
        editable={false}
      />
    </Box>
  );
}
