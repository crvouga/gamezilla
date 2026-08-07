import { useState } from 'react';
import { Box } from '../box';
import { Card } from '../card';
import { Divider } from '../divider';
import { ExampleRoot } from '../explorer/example-root';
import { Text } from '../text';
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

export default function CatalogExample() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <ExampleRoot>
      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label="Index (search + grouped list)"
      />
      <Card elevation={0}>
        <Box style={{ height: 320 }}>
          <CatalogList items={DEMO_ITEMS} onSelect={setSelectedId} />
        </Box>
      </Card>

      <Divider />

      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label="Detail (prev / next bottom bar)"
      />
      <Card elevation={0}>
        <Box style={{ height: 240 }}>
          <CatalogDetail
            items={DEMO_ITEMS}
            currentId={selectedId ?? 'box'}
            onNavigate={setSelectedId}
          >
            <Text
              variant="body"
              label={`Selected: ${selectedId ?? 'box'}. Use the arrows to move.`}
            />
          </CatalogDetail>
        </Box>
      </Card>
    </ExampleRoot>
  );
}
