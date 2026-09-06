/**
 * Category-grouped rows for {@link CatalogList}.
 */

import type { ReactNode } from 'react';

import { borderRadius } from '../../theme/scale';
import { releaseWebFocus } from '../../web/release-web-focus';
import { Box } from '../box';
import { EmptyState } from '../empty-state';
import { Pressable } from '../pressable';
import { Text } from '../text';
import { type CatalogItem, groupCatalogItems } from './catalog-item';

export type CatalogListRowsProps = {
  items: readonly CatalogItem[];
  onSelect: (id: string) => void;
};

export function CatalogListRows({
  items,
  onSelect,
}: CatalogListRowsProps): ReactNode {
  if (items.length === 0) {
    return (
      <EmptyState
        variant="compact"
        title="No matching items"
        body="Try a different search term."
      />
    );
  }

  return groupCatalogItems(items).map((group) => (
    <CatalogGroupBlock
      key={group.category ?? '__uncategorized'}
      category={group.category}
      items={group.items}
      onSelect={onSelect}
    />
  ));
}

function CatalogGroupBlock({
  category,
  items,
  onSelect,
}: {
  category: string | null;
  items: readonly CatalogItem[];
  onSelect: (id: string) => void;
}): ReactNode {
  return (
    <Box sx={{ gap: 1, mb: 4 }}>
      {category !== null ? (
        <Text
          variant="label"
          sx={{ color: 'textSecondary' }}
          label={category}
        />
      ) : null}
      {items.map((item) => (
        <CatalogRow key={item.id} item={item} onSelect={onSelect} />
      ))}
    </Box>
  );
}

function CatalogRow({
  item,
  onSelect,
}: {
  item: CatalogItem;
  onSelect: (id: string) => void;
}): ReactNode {
  return (
    <Pressable
      onPress={() => {
        releaseWebFocus();
        onSelect(item.id);
      }}
      sx={{
        py: 3,
        px: 4,
        background: 'surface',
        borderRadius: borderRadius.md,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Text variant="body" label={item.label} />
      <Text variant="caption" label="›" />
    </Pressable>
  );
}
