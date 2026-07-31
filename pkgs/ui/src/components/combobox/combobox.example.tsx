import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { ExampleRoot } from '../explorer/example-root';
import { Stack } from '../stack';
import { Text } from '../text';
import { Combobox } from './combobox';

const FRUITS = [
  { label: 'Apple', value: 'apple', searchText: 'apple' },
  { label: 'Banana', value: 'banana', searchText: 'banana' },
  { label: 'Cherry', value: 'cherry', searchText: 'cherry' },
  { label: 'Durian', value: 'durian', searchText: 'durian' },
  { label: 'Elderberry', value: 'elderberry', searchText: 'elderberry' },
];

export default function ComboboxExample() {
  const { t } = useLingui();
  const [fruit, setFruit] = useState<string | null>(null);

  return (
    <ExampleRoot>
      <Text variant="heading" label="Combobox" />

      <Stack spacing={3}>
        <Combobox
          label="Favorite fruit"
          options={FRUITS}
          value={fruit}
          onValueChange={setFruit}
          placeholder={t`Pick a fruit…`}
          searchPlaceholder={t`Filter fruits…`}
          emptyMessage="No matching fruits"
        />

        <Combobox
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
