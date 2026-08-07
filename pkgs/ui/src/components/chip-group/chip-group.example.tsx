import { useState } from 'react';
import { ExampleRoot } from '../explorer/example-root';
import { Text } from '../text';
import { ChipGroup } from './chip-group';

const OPTIONS = [
  { key: 'off' as const, label: 'Off' },
  { key: 'mid' as const, label: 'Mid' },
  { key: 'high' as const, label: 'High' },
];

export default function ChipGroupExample() {
  const [v, setV] = useState<'off' | 'mid' | 'high'>('mid');

  return (
    <ExampleRoot>
      <ChipGroup
        label="Intensity"
        options={OPTIONS}
        selected={v}
        onSelect={setV}
      />
      <Text variant="caption" sx={{ opacity: 0.75 }} label={`Selected: ${v}`} />
    </ExampleRoot>
  );
}
