import { useState } from 'react';
import { Box } from '../box';
import { Text } from '../text';
import { Stack } from '../stack';
import { SegmentedControl } from './segmented-control';

export default function SegmentedControlExample() {
  const [mode, setMode] = useState('playground');
  const [size, setSize] = useState('md');

  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading">SegmentedControl</Text>

      <Stack spacing={4}>
        <SegmentedControl
          segments={[
            { key: 'playground', label: 'Playground' },
            { key: 'inspector', label: 'Inspector' },
            { key: 'docs', label: 'Docs' },
          ]}
          selected={mode}
          onSelect={setMode}
        />

        <Text variant="caption">Selected: {mode}</Text>

        <SegmentedControl
          segments={[
            { key: 'sm', label: 'Small' },
            { key: 'md', label: 'Medium' },
            { key: 'lg', label: 'Large' },
          ]}
          selected={size}
          onSelect={setSize}
        />

        <Text variant="caption">Selected: {size}</Text>
      </Stack>
    </Box>
  );
}
