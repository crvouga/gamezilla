/** @jsxImportSource solid-js */
/**
 * `CatalogList` -- searchable, category-grouped index of catalog items.
 *
 * App-agnostic: selection is handled via `onSelect`. Pass `screenBodyBleed`
 * when nested under a non-scrolling padded screen body so the scrollbar
 * stays flush with the screen edge. The search bar stays fixed above the
 * scroll area.
 */

import { useLingui } from '@lingui/solid/macro';
import type { LocalizedString } from '@pkgs/i18n-shared/localized-string';
import type { CatalogItem } from '@pkgs/ui-shared/catalog-item';
import { filterCatalogItems } from '@pkgs/ui-shared/catalog-item';
import type { ComponentDataSet } from '@pkgs/ui-shared/component-id';
import { dataAttrs } from '@pkgs/ui-shared/component-id';
import { createMemo, createSignal, type JSX } from 'solid-js';
import { CatalogListRows } from './catalog-list-rows';
import { CatalogListSearch } from './catalog-list-search';
import { ScrollView } from './scroll-view';

export type CatalogListProps = {
  items: readonly CatalogItem[];
  onSelect: (id: string) => void;
  searchPlaceholder?: LocalizedString | undefined;
  /**
   * When true, bleeds under the screen body horizontal padding so the
   * scrollbar is flush. Omit outside a padded screen shell.
   */
  screenBodyBleed?: boolean | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function CatalogList(props: CatalogListProps): JSX.Element {
  const { t } = useLingui();
  const [query, setQuery] = createSignal('');
  const filtered = createMemo(() => filterCatalogItems(props.items, query()));
  const bleed = () => props.screenBodyBleed === true;

  return (
    <div
      class="box flex-1 min-h-0 gap-3"
      {...dataAttrs({ component: 'CatalogList', ...props.dataSet })}
      style={bleed() ? undefined : { padding: '16px' }}
    >
      <CatalogListSearch
        value={query()}
        onChangeText={setQuery}
        placeholder={props.searchPlaceholder ?? t`Search…`}
      />
      <ScrollView
        class="flex-1"
        flushEdge={bleed()}
        contentStyle={{
          gap: 'var(--ui-space-6)',
          'padding-bottom': 'var(--ui-space-16)',
        }}
      >
        <CatalogListRows items={filtered()} onSelect={props.onSelect} />
      </ScrollView>
    </div>
  );
}
