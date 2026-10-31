/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import type { CatalogItem } from '@pkgs/ui-root-shared-ts/catalog-item';

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { CatalogDetailNav } from '../catalog-detail-nav/index';
import {
  CONTENT_EDGE_PADDING_STEP,
  useContentEdgePadding,
} from '../content-edge-padding/index';
import { EmptyState } from '../empty-state/index';
import { ScreenLargeTitle } from '../screen-large-title/index';
import { ScrollView } from '../scroll-view/index';
import type { ScreenTitleScrollProps } from '../use-screen-title-scroll';

export type CatalogDetailProps = {
  items: readonly CatalogItem[];
  currentId: string;
  /** When provided, renders prev/next as a bottom chrome bar. */
  onNavigate?: ((id: string) => void) | undefined;
  children: JSX.Element;
  /**
   * When true, bleeds under the screen body horizontal padding so the
   * scrollbar and bottom nav are flush with the screen edge.
   */
  screenBodyBleed?: boolean | undefined;
  /**
   * When set, renders {@link ScreenLargeTitle} above children. Pair with the
   * screen's `largeTitle` + `titleScroll` for TopBar sync.
   */
  largeTitleLabel?: JSX.Element | undefined;
  /** Forwarded to the body scroller for large-title TopBar reveal. */
  titleScroll?: ScreenTitleScrollProps | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `CatalogDetail` -- detail screen chrome for a catalog item.
 *
 * Pins {@link CatalogDetailNav} as a bottom chrome bar when `onNavigate` is
 * provided (outside body content padding when `screenBodyBleed` — cancels
 * {@link ContentEdgePaddingProvider} horizontal inset). Prefer the screen's
 * `footer` slot for app screens that already have a pinned footer shell; pass
 * `onNavigate` here for embeds.
 *
 * Unknown `currentId` renders an {@link EmptyState} fallback.
 */
export function CatalogDetail(props: CatalogDetailProps): JSX.Element {
  const { t } = useLingui();
  const known = () => props.items.some((i) => i.id === props.currentId);
  const bleed = () => props.screenBodyBleed === true;
  const notFoundBody = () => {
    const id = props.currentId;
    return t`No catalog entry for "${id}".`;
  };

  return (
    <div
      class="box flex-1 min-h-0"
      {...dataAttrs({ component: 'CatalogDetail', ...props.dataSet })}
    >
      <Show
        when={known()}
        fallback={
          <EmptyState title={t`Item not found`} body={notFoundBody()} />
        }
      >
        <ScrollView
          grow
          flushEdge={bleed()}
          paddingBottom="3xl"
          paddingX={bleed() ? undefined : 'lg'}
          paddingTop={
            !bleed() && props.largeTitleLabel === undefined ? 'lg' : undefined
          }
          onScroll={props.titleScroll?.onScroll}
        >
          <Show when={props.largeTitleLabel !== undefined}>
            <ScreenLargeTitle label={props.largeTitleLabel} />
          </Show>
          {props.children}
        </ScrollView>
        <Show when={props.onNavigate}>
          {(onNavigate) => (
            <CatalogDetailBottomBar
              items={props.items}
              currentId={props.currentId}
              onNavigate={onNavigate()}
              screenBodyBleed={bleed()}
            />
          )}
        </Show>
      </Show>
    </div>
  );
}

function CatalogDetailBottomBar(props: {
  items: readonly CatalogItem[];
  currentId: string;
  onNavigate: (id: string) => void;
  screenBodyBleed: boolean;
}): JSX.Element {
  const edge = useContentEdgePadding();
  const step = () =>
    props.screenBodyBleed && edge !== null
      ? edge.horizontalStep
      : CONTENT_EDGE_PADDING_STEP;
  const flush = () => props.screenBodyBleed && edge !== null && step() !== 0;

  return (
    <div
      class="box border-border border-t py-1"
      style={{
        ...(flush()
          ? {
              'margin-left': `${-step() * 4}px`,
              'margin-right': `${-step() * 4}px`,
            }
          : {}),
        'padding-left': `${step() * 4}px`,
        'padding-right': `${step() * 4}px`,
      }}
    >
      <CatalogDetailNav
        items={props.items}
        currentId={props.currentId}
        onNavigate={props.onNavigate}
      />
    </div>
  );
}
