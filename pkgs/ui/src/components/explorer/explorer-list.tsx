/**
 * `ExplorerList` -- renders registered components grouped by category.
 *
 * Thin wrapper over {@link CatalogList}: maps {@link ComponentEntry} →
 * {@link CatalogItem} and forwards selection. App-agnostic navigation via
 * `onSelect`. Reactive to runtime registrations via
 * {@link useComponentRegistry} when no `entries` override is supplied.
 *
 * Pass `entries` to render a fixed, caller-owned list (e.g. the chess
 * settings screen passes only chess components so the global UI registry
 * is hidden).
 *
 * Pass `screenBodyBleed` when nested under a non-scrolling {@link ScreenBase}
 * body so the scrollbar stays flush with the screen edge.
 */

import type { LocalizedString } from '@pkgs/i18n';
import { useMemo } from 'react';
import { CatalogList, type CatalogItem } from '../catalog';
import {
  useComponentRegistry,
  type ComponentEntry,
} from './component-registry';

export type ExplorerListProps = {
  onSelect: (name: string) => void;
  entries?: readonly ComponentEntry[];
  /**
   * When true, bleeds under ScreenBase body horizontal padding so the
   * scrollbar is flush. Omit outside ScreenBase (e.g. chess settings embeds).
   */
  screenBodyBleed?: boolean;
};

function toCatalogItems(entries: readonly ComponentEntry[]): CatalogItem[] {
  return entries.map((c) => ({
    id: c.name,
    label: c.name,
    category: c.category,
  }));
}

export function ExplorerList({
  onSelect,
  entries,
  screenBodyBleed = false,
}: ExplorerListProps) {
  const globalRegistry = useComponentRegistry();
  const registry = entries ?? globalRegistry;
  const items = useMemo(() => toCatalogItems(registry), [registry]);

  return (
    <CatalogList
      items={items}
      onSelect={onSelect}
      screenBodyBleed={screenBodyBleed}
      searchPlaceholder={'Search components…' as LocalizedString}
    />
  );
}
