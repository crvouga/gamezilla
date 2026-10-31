import { useLingui } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { FilterBar } from '@pkgs/ui-root-client-ts/filter-bar';
import { createSignal } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

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
