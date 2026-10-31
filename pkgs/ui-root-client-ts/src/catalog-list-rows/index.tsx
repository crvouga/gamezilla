/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import type { CatalogItem } from '@pkgs/ui-root-shared-ts/catalog-item';
import { groupCatalogItems } from '@pkgs/ui-root-shared-ts/catalog-item';
import { createMemo, For, type JSX, Show } from 'solid-js';
import { EmptyState } from '../empty-state/index';
import { MenuRow } from '../menu-row/index';
import { MenuSection } from '../menu-section/index';

export type CatalogListRowsProps = {
  items: readonly CatalogItem[];
  onSelect: (id: string) => void;
};

/**
 * Category-grouped rows for {@link CatalogList}: the settings idiom, one
 * {@link MenuSection} (caption title, hairline panel) of {@link MenuRow}s
 * per category.
 */
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
    <MenuSection title={props.category ?? undefined}>
      <For each={props.items}>
        {(item) => (
          <MenuRow title={item.label} onClick={() => props.onSelect(item.id)} />
        )}
      </For>
    </MenuSection>
  );
}
