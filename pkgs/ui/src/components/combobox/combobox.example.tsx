/** @jsxImportSource solid-js */
import { useLingui } from '@lingui/solid/macro';
import { createSignal, type JSX } from 'solid-js';
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

export default function ComboboxExample(): JSX.Element {
  const { t } = useLingui();
  const [fruit, setFruit] = createSignal<string | null>(null);
  const [fruits, setFruits] = createSignal<string[]>([]);

  return (
    <ExampleRoot>
      <Stack spacing={3}>
        <Combobox
          label="Favorite fruit"
          options={FRUITS}
          value={fruit()}
          onValueChange={setFruit}
          placeholder={t`Pick a fruit…`}
          searchPlaceholder={t`Filter fruits…`}
          emptyMessage="No matching fruits"
        />

        <Combobox
          label="Favorite fruits (multi)"
          selectionMode="multiple"
          options={FRUITS}
          value={fruits()}
          onValueChange={setFruits}
          placeholder={t`Pick fruits…`}
          searchPlaceholder={t`Filter fruits…`}
          emptyMessage="No matching fruits"
        />
        <Text
          variant="caption"
          label={
            fruits().length === 0
              ? 'No fruits selected'
              : `Selected: ${fruits().join(', ')}`
          }
        />

        <Combobox
          label="Disabled"
          options={FRUITS}
          value={fruit()}
          onValueChange={setFruit}
          disabled
        />

        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label="Open these to see in-surface status (trigger stays enabled):"
        />

        <Combobox
          label="Loading"
          options={FRUITS}
          value={fruit()}
          onValueChange={setFruit}
          loading
          emptyMessage="No matching fruits"
        />

        <Combobox
          label="Error"
          options={FRUITS}
          value={fruit()}
          onValueChange={setFruit}
          error="User search failed (503): Service Unavailable"
          emptyMessage="No matching fruits"
        />
      </Stack>
    </ExampleRoot>
  );
}
