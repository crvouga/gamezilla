import { useState } from 'react';
import { Box } from '../box';
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
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="ChipGroup" />
      <ChipGroup
        label="Intensity"
        options={OPTIONS}
        selected={v}
        onSelect={setV}
      />
      <Text variant="caption" sx={{ opacity: 0.75 }} label={`Selected: ${v}`} />
    </Box>
  );
}
