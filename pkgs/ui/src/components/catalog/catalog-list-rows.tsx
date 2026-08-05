/**
 * Category-grouped rows for {@link CatalogList}.
 */

import type { ReactNode } from 'react';
import { View } from 'react-native';

import { borderRadius } from '../../theme/scale';
import { releaseWebFocus } from '../../web/release-web-focus';
import { EmptyState } from '../empty-state';
import { Pressable } from '../pressable';
import { Text } from '../text';
import { groupCatalogItems, type CatalogItem } from './catalog-item';

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
    <View style={{ gap: 4, marginBottom: 16 }}>
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
    </View>
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
