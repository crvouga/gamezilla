/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { Card } from '../card';
import { Divider } from '../divider';
import { ExampleRoot } from '../explorer/example-root';
import { CatalogDetail } from './catalog-detail';
import type { CatalogItem } from './catalog-item';
import { CatalogList } from './catalog-list';

const DEMO_ITEMS: readonly CatalogItem[] = [
  { id: 'box', label: 'Box', category: 'Foundation' },
  { id: 'text', label: 'Text', category: 'Foundation' },
  { id: 'button', label: 'Button', category: 'Inputs' },
  { id: 'switch', label: 'Switch', category: 'Inputs' },
  { id: 'card', label: 'Card', category: 'Data Display' },
];

export default function CatalogExample(): JSX.Element {
  const [selectedId, setSelectedId] = createSignal<string | null>(null);
  const currentId = (): string => selectedId() ?? 'box';

  return (
    <ExampleRoot>
      <label class="text textLabel text-text-secondary">
        {'Index (search + grouped list)'}
      </label>
      <Card elevation={0}>
        <div class="box h-[320px]">
          <CatalogList items={DEMO_ITEMS} onSelect={setSelectedId} />
        </div>
      </Card>

      <Divider />

      <label class="text textLabel text-text-secondary">
        {'Detail (prev / next bottom bar)'}
      </label>
      <Card elevation={0}>
        <div class="box h-[240px]">
          <CatalogDetail
            items={DEMO_ITEMS}
            currentId={currentId()}
            onNavigate={setSelectedId}
          >
            <p class="text">{`Selected: ${currentId()}. Use the arrows to move.`}</p>
          </CatalogDetail>
        </div>
      </Card>
    </ExampleRoot>
  );
}
