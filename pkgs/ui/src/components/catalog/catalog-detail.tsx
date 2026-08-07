/**
 * `CatalogDetail` -- detail screen chrome for a catalog item.
 *
 * Pins {@link CatalogDetailNav} as a bottom chrome bar when `onNavigate` is
 * provided (outside body content padding when `screenBodyBleed` — cancels
 * {@link ContentEdgePaddingProvider} horizontal inset). Prefer
 * {@link ScreenBase}'s `footer` slot for app screens that already have a
 * pinned footer shell; pass `onNavigate` here for embeds.
 *
 * Unknown `currentId` renders an {@link EmptyState} fallback.
 */

import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { Box } from '../box';
import {
  CONTENT_EDGE_PADDING_STEP,
  useContentEdgePadding,
} from '../content-edge-padding';
import { EmptyState } from '../empty-state';
import { ScreenBodyScrollView } from '../screen-base/screen-body-scroll-view';
import { ScreenLargeTitle, type ScreenTitleScrollProps } from '../screen-title';
import { ScrollView } from '../scroll-view';
import { CatalogDetailNav } from './catalog-detail-nav';
import type { CatalogItem } from './catalog-item';

export type CatalogDetailProps = {
  items: readonly CatalogItem[];
  currentId: string;
  /** When provided, renders prev/next as a bottom chrome bar. */
  onNavigate?: (id: string) => void;
  children: ReactNode;
  /**
   * When true, bleeds under ScreenBase body horizontal padding so the
   * scrollbar and bottom nav are flush with the screen edge.
   */
  screenBodyBleed?: boolean;
  /**
   * When set, renders {@link ScreenLargeTitle} above children. Pair with
   * ScreenBase `largeTitle` + `titleScroll` for TopBar sync.
   */
  largeTitleLabel?: ReactNode;
  /** Forwarded to the body scroller for large-title TopBar reveal. */
  titleScroll?: ScreenTitleScrollProps;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function CatalogDetail({
  items,
  currentId,
  onNavigate,
  children,
  screenBodyBleed = false,
  largeTitleLabel,
  titleScroll,
  dataSet,
}: CatalogDetailProps): ReactNode {
  const known = items.some((i) => i.id === currentId);

  if (!known) {
    return (
      <Box {...componentDataSet('CatalogDetail', dataSet)}>
        <EmptyState
          title="Item not found"
          body={`No catalog entry for "${currentId}".`}
        />
      </Box>
    );
  }

  return (
    <CatalogDetailKnown
      items={items}
      currentId={currentId}
      onNavigate={onNavigate}
      screenBodyBleed={screenBodyBleed}
      largeTitleLabel={largeTitleLabel}
      titleScroll={titleScroll}
      dataSet={dataSet}
    >
      {children}
    </CatalogDetailKnown>
  );
}

function CatalogDetailKnown({
  items,
  currentId,
  onNavigate,
  children,
  screenBodyBleed,
  largeTitleLabel,
  titleScroll,
  dataSet,
}: {
  items: readonly CatalogItem[];
  currentId: string;
  onNavigate: ((id: string) => void) | undefined;
  children: ReactNode;
  screenBodyBleed: boolean;
  largeTitleLabel: ReactNode | undefined;
  titleScroll: ScreenTitleScrollProps | undefined;
  dataSet: ComponentDataSet | undefined;
}): ReactNode {
  return (
    <Box
      style={{ flex: 1, minHeight: 0 }}
      {...componentDataSet('CatalogDetail', dataSet)}
    >
      {renderDetailBody(
        children,
        screenBodyBleed,
        largeTitleLabel,
        titleScroll
      )}
      {onNavigate === undefined ? null : (
        <CatalogDetailBottomBar
          items={items}
          currentId={currentId}
          onNavigate={onNavigate}
          screenBodyBleed={screenBodyBleed}
        />
      )}
    </Box>
  );
}

function CatalogDetailBottomBar({
  items,
  currentId,
  onNavigate,
  screenBodyBleed,
}: {
  items: readonly CatalogItem[];
  currentId: string;
  onNavigate: (id: string) => void;
  screenBodyBleed: boolean;
}): ReactNode {
  const edge = useContentEdgePadding();
  const step =
    screenBodyBleed && edge !== null
      ? edge.horizontalStep
      : CONTENT_EDGE_PADDING_STEP;
  const flush = screenBodyBleed && edge !== null && step !== 0;

  return (
    <Box
      sx={{
        background: 'surface',
        borderColor: 'border',
        px: step,
        py: 1,
        ...(flush ? { mx: -step } : {}),
      }}
      style={{ borderTopWidth: StyleSheet.hairlineWidth }}
    >
      <CatalogDetailNav
        items={items}
        currentId={currentId}
        onNavigate={onNavigate}
      />
    </Box>
  );
}

function renderDetailBody(
  children: ReactNode,
  screenBodyBleed: boolean,
  largeTitleLabel: ReactNode | undefined,
  titleScroll: ScreenTitleScrollProps | undefined
): ReactNode {
  const body = (
    <>
      {largeTitleLabel === undefined ? null : (
        <ScreenLargeTitle label={largeTitleLabel} />
      )}
      {children}
    </>
  );
  const scrollProps = titleScroll ?? {};

  if (screenBodyBleed) {
    return (
      <ScreenBodyScrollView sx={{ pb: 16 }} {...scrollProps}>
        {body}
      </ScreenBodyScrollView>
    );
  }
  return (
    <ScrollView
      style={{ flex: 1 }}
      sx={{
        px: 4,
        pb: 16,
        ...(largeTitleLabel === undefined ? { pt: 4 } : {}),
      }}
      {...scrollProps}
    >
      {body}
    </ScrollView>
  );
}
