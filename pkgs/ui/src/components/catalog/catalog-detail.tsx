/** @jsxImportSource solid-js */
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

import { useLingui } from '@lingui/solid/macro';
import { type JSX, Show } from 'solid-js';

import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import {
  CONTENT_EDGE_PADDING_STEP,
  useContentEdgePadding,
} from '../content-edge-padding';
import { EmptyState } from '../empty-state';
import { ScreenLargeTitle, type ScreenTitleScrollProps } from '../screen-title';
import { ScrollView } from '../scroll-view';
import { CatalogDetailNav } from './catalog-detail-nav';
import type { CatalogItem } from './catalog-item';

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

export function CatalogDetail(props: CatalogDetailProps): JSX.Element {
  const { t } = useLingui();
  const known = () => props.items.some((i) => i.id === props.currentId);
  const bleed = () => props.screenBodyBleed === true;
  const notFoundBody = () => {
    const id = props.currentId;
    return t`No catalog entry for "${id}".`;
  };

  return (
    <Box
      sx={{ flex: 1, minHeight: 0 }}
      dataSet={{ component: 'CatalogDetail', ...props.dataSet }}
    >
      <Show
        when={known()}
        fallback={
          <EmptyState title={t`Item not found`} body={notFoundBody()} />
        }
      >
        <ScrollView
          frameSx={{ flex: 1 }}
          flushEdge={bleed()}
          sx={[
            { pb: 16 },
            !bleed() && { px: 4 },
            !bleed() && props.largeTitleLabel === undefined && { pt: 4 },
          ]}
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
    </Box>
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
    <Box
      sx={[
        {
          background: 'surface',
          borderColor: 'border',
          borderTopWidth: 'hairline',
          px: step(),
          py: 1,
        },
        flush() && { mx: -step() },
      ]}
    >
      <CatalogDetailNav
        items={props.items}
        currentId={props.currentId}
        onNavigate={props.onNavigate}
      />
    </Box>
  );
}
