/** @jsxImportSource solid-js */
/**
 * `ExplorerList` -- {@link ScreenBase} listing every registered component
 * example grouped by `group`, with a search field.
 *
 * App-agnostic navigation: pass `onSelect(id)` to handle row activation
 * yourself, or `hrefFor(id)` to push the detail route through the ambient
 * `AppRouterProvider`. Pass `entries` to render a caller-owned list instead of
 * the built-in registry.
 */

import { useLingui } from '@lingui/solid/macro';
import { createMemo, type JSX, untrack } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { type Href, useRouter } from '../../navigation';
import { CatalogList } from '../catalog';
import { ScreenBase } from '../screen-base';
import {
  type ComponentEntry,
  componentRegistry,
  registryEntries,
  toCatalogItems,
} from './component-registry';

export type ExplorerListProps = {
  /** Called with the entry `id` when a row is activated. */
  onSelect?: ((id: string) => void) | undefined;
  /** Detail route for an entry; pushed via `useRouter` when `onSelect` is omitted. */
  hrefFor?: ((id: string) => Href) | undefined;
  /** Caller-owned entries (defaults to the built-in registry). */
  entries?: readonly ComponentEntry[] | undefined;
  /** Screen title (last breadcrumb). Defaults to "Components". */
  title?: JSX.Element | undefined;
  /** `data-screen` identifier. Defaults to `ui-explorer`. */
  screenId?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/**
 * Resolve the row activation handler once: `onSelect` wins; otherwise
 * `hrefFor` is pushed through the router. Throws when neither is supplied so
 * a misconfigured screen fails at mount rather than on first tap.
 */
function useSelectHandler(props: ExplorerListProps): (id: string) => void {
  const onSelect = untrack(() => props.onSelect);
  const hrefFor = untrack(() => props.hrefFor);
  if (onSelect !== undefined) return onSelect;
  if (hrefFor === undefined) {
    throw new Error('ExplorerList: pass `onSelect` or `hrefFor`');
  }
  const router = useRouter();
  return (id) => router.push(hrefFor(id));
}

export function ExplorerList(props: ExplorerListProps): JSX.Element {
  const { t } = useLingui();
  const select = useSelectHandler(props);
  const items = createMemo(() =>
    toCatalogItems(props.entries ?? registryEntries(componentRegistry))
  );
  return (
    <ScreenBase
      screenId={props.screenId ?? 'ui-explorer'}
      breadcrumbs={[{ name: props.title ?? t`Components` }]}
      dataSet={{ component: 'ExplorerList', ...props.dataSet }}
      content={() => (
        <CatalogList
          items={items()}
          onSelect={select}
          screenBodyBleed
          searchPlaceholder={t`Search components…`}
        />
      )}
    />
  );
}
