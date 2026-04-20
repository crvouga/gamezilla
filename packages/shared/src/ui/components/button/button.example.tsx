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
        <Button title="Solid" variant="solid" onPressIn={() => {}} />
        <Button title="Outlined" variant="outlined" onPressIn={() => {}} />
        <Button title="Ghost" variant="ghost" onPressIn={() => {}} />
        <Button title="Text" variant="text" onPressIn={() => {}} />
      </Stack>

      <Divider />

      <Stack spacing={2}>
        <Text variant="label" label="Sizes" />
        <Button title="Small" size="sm" onPressIn={() => {}} />
        <Button title="Medium" size="md" onPressIn={() => {}} />
        <Button title="Large" size="lg" onPressIn={() => {}} />
      </Stack>

      <Divider />

      <Stack spacing={2}>
        <Text variant="label" label="Colors" />
        <Button title="Tint (default)" color="tint" onPressIn={() => {}} />
        <Button title="Success" color="success" onPressIn={() => {}} />
        <Button title="Warning" color="warning" onPressIn={() => {}} />
        <Button title="Destructive" color="destructive" onPressIn={() => {}} />
      </Stack>

      <Divider />

      <Stack spacing={2}>
        <Text variant="label" label="States" />
        <Button title="Disabled" disabled onPressIn={() => {}} />
        <Button
          title={loading ? 'Loading...' : 'Tap to load'}
          loading={loading}
          onPressIn={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 2000);
          }}
        />
      </Stack>
    </Box>
  );
}
