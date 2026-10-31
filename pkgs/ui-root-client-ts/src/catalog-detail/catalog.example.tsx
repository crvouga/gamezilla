/** @jsxImportSource solid-js */

import { CatalogDetail } from '@pkgs/ui-root-client-ts/catalog-detail';
import { CatalogList } from '@pkgs/ui-root-client-ts/catalog-list';
import type { CatalogItem } from '@pkgs/ui-root-shared-ts/catalog-item';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

const DEMO_ITEMS: readonly CatalogItem[] = [
  { id: 'button', label: 'Button', category: 'Inputs' },
  { id: 'switch', label: 'Switch', category: 'Inputs' },
  { id: 'list', label: 'List', category: 'Data Display' },
];

export default function CatalogExample(): JSX.Element {
  const [selectedId, setSelectedId] = createSignal<string | null>(null);
  const currentId = (): string => selectedId() ?? 'button';

  return (
    <ExampleRoot>
      <label class="text textLabel text-text-secondary">
        {'Index (search + grouped list)'}
      </label>
      <div class="card">
        <div class="box h-80">
          <CatalogList items={DEMO_ITEMS} onSelect={setSelectedId} />
        </div>
      </div>

      <div class="divider" role="separator" />

      <label class="text textLabel text-text-secondary">
        {'Detail (prev / next bottom bar)'}
      </label>
      <div class="card">
        <div class="box h-60">
          <CatalogDetail
            items={DEMO_ITEMS}
            currentId={currentId()}
            onNavigate={setSelectedId}
          >
            <p class="text">{`Selected: ${currentId()}. Use the arrows to move.`}</p>
          </CatalogDetail>
        </div>
      </div>
    </ExampleRoot>
  );
}
