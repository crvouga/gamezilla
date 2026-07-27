import { useState } from 'react';
import { Text } from '../text';
import { Stack } from '../stack';
import { SegmentedControl } from './segmented-control';
import { ExampleRoot } from '../explorer/example-root';

export default function SegmentedControlExample() {
  const [mode, setMode] = useState('playground');
  const [size, setSize] = useState('md');

  return (
    <ExampleRoot>
      <Text variant="heading" label="SegmentedControl" />

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

        <Text variant="caption" label={`Selected: ${mode}`} />

        <SegmentedControl
          segments={[
            { key: 'sm', label: 'Small' },
            { key: 'md', label: 'Medium' },
            { key: 'lg', label: 'Large' },
          ]}
          selected={size}
          onSelect={setSize}
        />

        <Text variant="caption" label={`Selected: ${size}`} />
      </Stack>
    </ExampleRoot>
  );
}
