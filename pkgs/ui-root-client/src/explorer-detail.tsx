/** @jsxImportSource solid-js */
/**
 * `ExplorerDetail` -- {@link ScreenBase} rendering one registered component
 * example by `id`, with prev / next navigation in the footer.
 *
 * Unknown ids render an {@link EmptyState} "Component not found" body. Pass
 * `onNavigate(id)` or `hrefFor(id)` to enable prev / next across the entry
 * list; pass `listHref` / `onBack` so the "Components" breadcrumb can go back.
 */

import { useLingui } from '@lingui/solid/macro';
import type { ComponentEntry } from '@pkgs/ui-root-shared/component-entry';
import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import type { Href } from '@pkgs/ui-root-shared/href';
import { createMemo, type JSX, Show, untrack } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { useRouter } from './app-router';
import { CatalogDetail } from './catalog-detail';
import { CatalogDetailNav } from './catalog-detail-nav';
import {
  componentRegistry,
  registryEntries,
  toCatalogItems,
} from './component-registry';
import { EmptyState } from './empty-state';
import { ScreenBase } from './screen-base';
import type { ScreenBaseBreadcrumb } from './screen-base-types';

export type ExplorerDetailProps = {
  /** Registry entry id (see {@link ComponentEntry.id}). */
  componentId: string;
  /** Caller-owned entries (defaults to the built-in registry). */
  entries?: readonly ComponentEntry[] | undefined;
  /** Prev / next handler. Wins over `hrefFor`. */
  onNavigate?: ((id: string) => void) | undefined;
  /** Detail route for an entry; pushed via `useRouter` for prev / next. */
  hrefFor?: ((id: string) => Href) | undefined;
  /** Route of the list screen for the parent breadcrumb. */
  listHref?: Href | undefined;
  /** Parent breadcrumb click handler. Wins over `listHref`. */
  onBack?: (() => void) | undefined;
  /** Parent breadcrumb label. Defaults to "Components". */
  listTitle?: JSX.Element | undefined;
  /** `data-screen` identifier. Defaults to `ui-explorer-detail`. */
  screenId?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/** `onNavigate` wins; otherwise `hrefFor` is pushed through the router. */
function useNavigateHandler(
  props: ExplorerDetailProps
): ((id: string) => void) | undefined {
  const onNavigate = untrack(() => props.onNavigate);
  const hrefFor = untrack(() => props.hrefFor);
  if (onNavigate !== undefined) return onNavigate;
  if (hrefFor === undefined) return undefined;
  const router = useRouter();
  return (id) => router.push(hrefFor(id));
}

function NotFound(props: { componentId: string }): JSX.Element {
  const { t } = useLingui();
  const body = () => {
    const id = props.componentId;
    return t`No example registered for "${id}".`;
  };
  return (
    <EmptyState
      title={t`Component not found`}
      body={body()}
      dataSet={{ testid: 'explorer-not-found' }}
    />
  );
}

export function ExplorerDetail(props: ExplorerDetailProps): JSX.Element {
  const { t } = useLingui();
  const navigate = useNavigateHandler(props);
  const entries = createMemo(
    () => props.entries ?? registryEntries(componentRegistry)
  );
  const items = createMemo(() => toCatalogItems(entries()));
  const entry = createMemo(() =>
    entries().find((e) => e.id === props.componentId)
  );
  const breadcrumbs = (): ScreenBaseBreadcrumb[] => [
    {
      name: props.listTitle ?? t`Components`,
      onClick: props.onBack,
      href: props.listHref,
    },
    { name: entry()?.title ?? props.componentId },
  ];
  return (
    <ScreenBase
      screenId={props.screenId ?? 'ui-explorer-detail'}
      breadcrumbs={breadcrumbs()}
      dataSet={{ component: 'ExplorerDetail', ...props.dataSet }}
      content={() => (
        <Show
          when={entry()}
          fallback={<NotFound componentId={props.componentId} />}
        >
          {(found) => (
            <CatalogDetail
              items={items()}
              currentId={props.componentId}
              screenBodyBleed
            >
              <Dynamic component={found().Example} />
            </CatalogDetail>
          )}
        </Show>
      )}
      footer={
        navigate === undefined ? undefined : (
          <Show when={entry() !== undefined}>
            <CatalogDetailNav
              items={items()}
              currentId={props.componentId}
              onNavigate={navigate}
            />
          </Show>
        )
      }
    />
  );
}
