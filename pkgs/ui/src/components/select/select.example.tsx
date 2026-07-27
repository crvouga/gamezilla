import { useState } from 'react';
import { Text } from '../text';
import { Stack } from '../stack';
import { Select } from './select';
import { ExampleRoot } from '../explorer/example-root';

const FRUITS = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
  { label: 'Durian', value: 'durian' },
];

const DELAYS = [
  { label: '0 ms', value: 0 },
  { label: '50 ms', value: 50 },
  { label: '150 ms', value: 150 },
  { label: '500 ms', value: 500 },
];

export default function SelectExample() {
  const [fruit, setFruit] = useState('banana');
  const [delay, setDelay] = useState(50);

  return (
    <ExampleRoot>
      <Text variant="heading" label="Select" />

      <Stack spacing={3}>
        <Select
          label="Favorite fruit"
          options={FRUITS}
          value={fruit}
          onValueChange={setFruit}
        />

        <Select
          label="Network delay"
          options={DELAYS}
          value={delay}
          onValueChange={setDelay}
        />

        <Select
          label="Disabled"
          options={FRUITS}
          value={fruit}
          onValueChange={setFruit}
          disabled
        />
      </Stack>
    </ExampleRoot>
  );
}
