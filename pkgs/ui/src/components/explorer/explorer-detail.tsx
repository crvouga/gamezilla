/**
 * `ExplorerDetail` -- renders a single component example by name.
 *
 * Looks up the component in the registry and renders its Example inside
 * {@link CatalogDetail}. Reactive to runtime registrations via
 * {@link useComponentRegistry} when no `entries` override is supplied.
 * Pass `entries` to scope the lookup to a caller-owned list (e.g. chess-only
 * entries from chess settings).
 *
 * Pass `onNavigate` to enable a bottom prev/next chrome bar across the same
 * entry list (embeds). App screens that use {@link ScreenBase} `footer`
 * should omit it and render {@link CatalogDetailNav} in the footer instead.
 * When omitted, the nav bar is hidden.
 *
 * Pass `screenBodyBleed` when nested under a non-scrolling {@link ScreenBase}
 * body so the scrollbar stays flush with the screen edge.
 */

import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { CatalogDetail, type CatalogItem } from '../catalog';
import { EmptyState } from '../empty-state';
import type { ScreenTitleScrollProps } from '../screen-title';
import {
  type ComponentEntry,
  useComponentRegistry,
} from './component-registry';

export type ExplorerDetailProps = {
  componentName: string;
  entries?: readonly ComponentEntry[];
  /** When provided, enables prev/next navigation across the entry list. */
  onNavigate?: (name: string) => void;
  /**
   * When true, bleeds under ScreenBase body horizontal padding so the
   * scrollbar is flush. Omit outside ScreenBase (e.g. chess settings embeds).
   */
  screenBodyBleed?: boolean;
  /**
   * When true, CatalogDetail renders a large title from the component name.
   * Pair with ScreenBase `largeTitle` + `titleScroll` for TopBar sync.
   */
  largeTitle?: boolean;
  /** Forwarded to CatalogDetail for large-title TopBar reveal. */
  titleScroll?: ScreenTitleScrollProps;
};

function toCatalogItems(entries: readonly ComponentEntry[]): CatalogItem[] {
  return entries.map((c) => ({
    id: c.name,
    label: c.name,
    category: c.category,
  }));
}

export function ExplorerDetail({
  componentName,
  entries,
  onNavigate,
  screenBodyBleed = false,
  largeTitle = false,
  titleScroll,
}: ExplorerDetailProps): ReactNode {
  const globalRegistry = useComponentRegistry();
  const registry = entries ?? globalRegistry;
  const items = useMemo(() => toCatalogItems(registry), [registry]);
  const entry = registry.find((c) => c.name === componentName);

  if (!entry) {
    return (
      <EmptyState
        title="Component not found"
        body={`No example registered for "${componentName}".`}
      />
    );
  }

  const { Example } = entry;

  return (
    <CatalogDetail
      items={items}
      currentId={componentName}
      {...(onNavigate === undefined ? {} : { onNavigate })}
      screenBodyBleed={screenBodyBleed}
      {...(largeTitle ? { largeTitleLabel: componentName } : {})}
      {...(titleScroll === undefined ? {} : { titleScroll })}
    >
      <Example />
    </CatalogDetail>
  );
}
