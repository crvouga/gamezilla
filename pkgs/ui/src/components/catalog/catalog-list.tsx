/**
 * `CatalogList` -- searchable, category-grouped index of catalog items.
 *
 * App-agnostic: selection is handled via `onSelect`. Pass `screenBodyBleed`
 * when nested under a non-scrolling {@link ScreenBase} body so the scrollbar
 * stays flush with the screen edge. The search bar stays fixed above the
 * scroll area.
 */

import type { LocalizedString } from '@pkgs/i18n';
import { type ReactNode, useMemo, useState } from 'react';

import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { ScreenBodyScrollView } from '../screen-base/screen-body-scroll-view';
import { ScrollView } from '../scroll-view';
import { type CatalogItem, filterCatalogItems } from './catalog-item';
import { CatalogListRows } from './catalog-list-rows';
import { CatalogListSearch } from './catalog-list-search';

const DEFAULT_SEARCH_PLACEHOLDER = 'Search…' as LocalizedString;

export type CatalogListProps = {
  items: readonly CatalogItem[];
  onSelect: (id: string) => void;
  searchPlaceholder?: LocalizedString;
  /**
   * When true, bleeds under ScreenBase body horizontal padding so the
   * scrollbar is flush. Omit outside ScreenBase.
   */
  screenBodyBleed?: boolean;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function CatalogList({
  items,
  onSelect,
  searchPlaceholder = DEFAULT_SEARCH_PLACEHOLDER,
  screenBodyBleed = false,
  dataSet,
}: CatalogListProps): ReactNode {
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => filterCatalogItems(items, query),
    [items, query]
  );

  const search = (
    <CatalogListSearch
      value={query}
      onChangeText={setQuery}
      placeholder={searchPlaceholder}
    />
  );
  const rows = <CatalogListRows items={filtered} onSelect={onSelect} />;

  if (screenBodyBleed) {
    return (
      <Box
        sx={{ flex: 1, minHeight: 0, gap: 3 }}
        dataSet={{ component: 'CatalogList', ...dataSet }}
      >
        {search}
        <ScreenBodyScrollView sx={{ gap: 6, pb: 16 }}>
          {rows}
        </ScreenBodyScrollView>
      </Box>
    );
  }

  return (
    <Box
      sx={{ flex: 1, minHeight: 0, p: 4, gap: 3 }}
      dataSet={{ component: 'CatalogList', ...dataSet }}
    >
      {search}
      <ScrollView
        frameSx={{ flex: 1 }}
        flushEdge={false}
        sx={{ gap: 6, pb: 16 }}
      >
        {rows}
      </ScrollView>
    </Box>
  );
}
