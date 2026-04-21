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
        <Text variant="label" label="Variants" />
        <Button title="Solid" variant="solid" onPress={() => {}} />
        <Button title="Outlined" variant="outlined" onPress={() => {}} />
        <Button title="Ghost" variant="ghost" onPress={() => {}} />
        <Button title="Text" variant="text" onPress={() => {}} />
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
        <Text variant="label" label="Colors" />
        <Button title="Tint (default)" color="tint" onPress={() => {}} />
        <Button title="Success" color="success" onPress={() => {}} />
        <Button title="Warning" color="warning" onPress={() => {}} />
        <Button title="Destructive" color="destructive" onPress={() => {}} />
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
