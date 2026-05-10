import { useState } from 'react';
import { Box } from '../box';
import { Divider } from '../divider';
import { Stack } from '../stack';
import { Text } from '../text';
import { Button } from './button';

export default function ButtonExample() {
  const [loading, setLoading] = useState(false);

  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="Button" />

      <Stack spacing={2}>
        <Text variant="label" label="Intents" />
        <Button title="Primary" intent="primary" onPress={() => {}} />
        <Button title="Danger" intent="danger" onPress={() => {}} />
        <Button title="Neutral" intent="neutral" onPress={() => {}} />
      </Stack>

      <Divider />

      <Stack spacing={2}>
        <Text variant="label" label="Sizes" />
        <Button title="Small" size="sm" onPress={() => {}} />
        <Button title="Medium" size="md" onPress={() => {}} />
        <Button title="Large" size="lg" onPress={() => {}} />
      </Stack>

      <Divider />

      <Stack spacing={2}>
        <Text variant="label" label="States" />
        <Button title="Disabled" disabled onPress={() => {}} />
        <Button
          title={loading ? 'Loading...' : 'Tap to load'}
          loading={loading}
          onPress={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 2000);
          }}
        />
      </Stack>
    </Box>
  );
}
