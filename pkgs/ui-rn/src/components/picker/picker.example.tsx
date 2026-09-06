import { useState } from 'react';
import { Box } from '../box';
import { ExampleRoot } from '../explorer/example-root';
import { Text } from '../text';
import { Picker, type PickerOption } from './picker';

const OPTIONS: PickerOption<string>[] = [
  {
    value: 'a',
    label: 'Alpha',
    preview: (
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: '#c084fc',
        }}
      />
    ),
  },
  {
    value: 'b',
    label: 'Bravo',
    preview: (
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: '#38bdf8',
        }}
      />
    ),
  },
  {
    value: 'c',
    label: 'Charlie',
    preview: (
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: '#4ade80',
        }}
      />
    ),
  },
];

export default function PickerExample() {
  const [v, setV] = useState<string>('a');

  return (
    <ExampleRoot>
      <Picker
        label="With preview thumbs"
        options={OPTIONS}
        value={v}
        onValueChange={setV}
      />
      <Text variant="caption" sx={{ opacity: 0.75 }} label={`Selected: ${v}`} />
    </ExampleRoot>
  );
}
