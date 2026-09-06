/** @jsxImportSource solid-js */
/**
 * Category-grouped rows for {@link CatalogList}.
 */

import { useLingui } from '@lingui/solid/macro';
import { createMemo, For, type JSX, Show } from 'solid-js';

import { Box } from '../box';
import { Clickable } from '../clickable';
import { EmptyState } from '../empty-state';
import { Text } from '../text';
import { type CatalogItem, groupCatalogItems } from './catalog-item';

export type CatalogListRowsProps = {
  items: readonly CatalogItem[];
  onSelect: (id: string) => void;
};

export function CatalogListRows(props: CatalogListRowsProps): JSX.Element {
  const { t } = useLingui();
  const groups = createMemo(() => groupCatalogItems(props.items));
  return (
    <Show
      when={props.items.length > 0}
      fallback={
        <EmptyState
          variant="compact"
          title={t`No matching items`}
          body={t`Try a different search term.`}
        />
      }
    >
      <For each={groups()}>
        {(group) => (
          <CatalogGroupBlock
            category={group.category}
            items={group.items}
            onSelect={props.onSelect}
          />
        )}
      </For>
    </Show>
  );
}

function CatalogGroupBlock(props: {
  category: string | null;
  items: readonly CatalogItem[];
  onSelect: (id: string) => void;
}): JSX.Element {
  return (
    <Box as="section" sx={{ gap: 1, mb: 4 }}>
      <Show when={props.category !== null}>
        <Text
          as="h3"
          variant="label"
          sx={{ color: 'textSecondary' }}
          label={props.category}
        />
      </Show>
      <Box as="ul" role="list" sx={{ gap: 1 }}>
        <For each={props.items}>
          {(item) => (
            <Box as="li">
              <CatalogRow item={item} onSelect={props.onSelect} />
            </Box>
          )}
        </For>
      </Box>
    </Box>
  );
}

function CatalogRow(props: {
  item: CatalogItem;
  onSelect: (id: string) => void;
}): JSX.Element {
  return (
    <Clickable
      onClick={() => props.onSelect(props.item.id)}
      sx={{
        py: 3,
        px: 4,
        minHeight: 44,
        background: 'surface',
        borderRadius: 'md',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        textAlign: 'left',
      }}
    >
      <Text variant="body" label={props.item.label} />
      <Text variant="caption" aria-hidden="true" label="›" />
    </Clickable>
  );
}
