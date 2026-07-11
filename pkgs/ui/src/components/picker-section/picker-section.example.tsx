import { useState } from 'react';
import { Box } from '../box';
import { ChipGroup } from '../chip-group';
import { Text } from '../text';
import { PickerSection } from './picker-section';

const OPTIONS = [
  { key: 'a' as const, label: 'Alpha' },
  { key: 'b' as const, label: 'Beta' },
];

export default function PickerSectionExample() {
  const [v, setV] = useState<'a' | 'b'>('a');

  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="PickerSection" />
      <PickerSection
        label="Mood"
        description="Wraps any inline picker with consistent label spacing."
      >
        <ChipGroup options={OPTIONS} selected={v} onSelect={setV} />
      </PickerSection>
    </Box>
  );
}
