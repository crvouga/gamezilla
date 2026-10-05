/** @jsxImportSource solid-js */
/**
 * Category-grouped rows for {@link CatalogList}.
 */

import { useLingui } from '@lingui/solid/macro';
import type { CatalogItem } from '@pkgs/ui-root-shared/catalog-item';
import { groupCatalogItems } from '@pkgs/ui-root-shared/catalog-item';
import { createMemo, For, type JSX, Show } from 'solid-js';
import { EmptyState } from './empty-state';

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
    <section class="box gap-1 mb-4">
      <Show when={props.category !== null}>
        <h3 class="text textLabel text-text-secondary">{props.category}</h3>
      </Show>
      <ul class="box gap-1">
        <For each={props.items}>
          {(item) => (
            <li class="box">
              <CatalogRow item={item} onSelect={props.onSelect} />
            </li>
          )}
        </For>
      </ul>
    </section>
  );
}

function CatalogRow(props: {
  item: CatalogItem;
  onSelect: (id: string) => void;
}): JSX.Element {
  return (
    <button
      class="clickable clickableTint py-3 px-4 min-h-11 bg-surface rounded-control flex-row justify-between items-center text-left"
      type="button"
      onClick={() => props.onSelect(props.item.id)}
    >
      <p class="text">{props.item.label}</p>
      <p class="text textCaption" aria-hidden="true">
        {'›'}
      </p>
    </button>
  );
}
