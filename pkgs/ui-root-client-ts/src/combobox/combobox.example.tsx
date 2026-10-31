/** @jsxImportSource solid-js */
import { useLingui } from '@lingui/solid/macro';
import { Combobox } from '@pkgs/ui-root-client-ts/combobox';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

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
      <div class="box flex-col gap-3">
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
        <p class="text textCaption">
          {fruits().length === 0
            ? 'No fruits selected'
            : `Selected: ${fruits().join(', ')}`}
        </p>

        <Combobox
          label="Disabled"
          options={FRUITS}
          value={fruit()}
          onValueChange={setFruit}
          disabled
        />

        <p class="text textCaption text-text-secondary">
          {'Open these to see in-surface status (trigger stays enabled):'}
        </p>

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
      </div>
    </ExampleRoot>
  );
}
