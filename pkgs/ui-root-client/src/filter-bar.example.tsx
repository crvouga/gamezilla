import { useLingui } from '@lingui/solid/macro';
import { createSignal } from 'solid-js';
import { Badge } from './badge';
import { ExampleRoot } from './example-root';
import { FilterBar } from './filter-bar';

export default function FilterBarExample() {
  const { t } = useLingui();
  const [query, setQuery] = createSignal('');
  return (
    <ExampleRoot>
      <FilterBar
        value={query()}
        onChange={setQuery}
        label={t`Find items`}
        placeholder={t`Search by name`}
      >
        <Badge label="All items" intent="neutral" />
      </FilterBar>
    </ExampleRoot>
  );
}
