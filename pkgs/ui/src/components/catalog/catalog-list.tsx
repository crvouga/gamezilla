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
import type { LocalizedString } from '@pkgs/i18n/localized-string';
import { createMemo, createSignal, type JSX } from 'solid-js';

import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { ScrollView } from '../scroll-view';
import { type CatalogItem, filterCatalogItems } from './catalog-item';
import { CatalogListRows } from './catalog-list-rows';
import { CatalogListSearch } from './catalog-list-search';

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
    <Box
      sx={[{ flex: 1, minHeight: 0, gap: 3 }, !bleed() && { p: 4 }]}
      dataSet={{ component: 'CatalogList', ...props.dataSet }}
    >
      <CatalogListSearch
        value={query()}
        onChangeText={setQuery}
        placeholder={props.searchPlaceholder ?? t`Search…`}
      />
      <ScrollView
        frameSx={{ flex: 1 }}
        flushEdge={bleed()}
        sx={{ gap: 6, pb: 16 }}
      >
        <CatalogListRows items={filtered()} onSelect={props.onSelect} />
      </ScrollView>
    </Box>
  );
}
