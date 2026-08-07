import { useState } from 'react';
import { ExampleRoot } from '../explorer/example-root';
import { Stack } from '../stack';
import { Text } from '../text';
import { SegmentedControl } from './segmented-control';

export default function SegmentedControlExample() {
  const [mode, setMode] = useState('playground');
  const [size, setSize] = useState('md');

  return (
    <ExampleRoot>
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
