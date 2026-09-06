/**
 * Themed {@link LegendList} with `sx` on the content container.
 * Nuclear overhaul: preferred virtualizer for RN + RN-web.
 * Data-mode only (no children-mode) so `exactOptionalPropertyTypes` stays clean.
 */

import { LegendList as RNLegendList } from '@legendapp/list';
import {
  type ComponentProps,
  type ComponentRef,
  forwardRef,
  type ReactElement,
  type Ref,
} from 'react';
import type { ComponentDataSet } from '../../component-id';
import {
  flattenSx,
  type SxInput,
  useHostSx,
  withPointerEvents,
} from '../../theme';
import { Box } from '../box';
import {
  resolveFlushEdgeStyles,
  useContentEdgePadding,
} from '../content-edge-padding';

type LegendListBaseProps = ComponentProps<typeof RNLegendList>;

type DataModeLegendListProps = Extract<
  LegendListBaseProps,
  { data: ReadonlyArray<unknown> }
>;

type DataModeLegendListPropsOf<ItemT> = Omit<
  DataModeLegendListProps,
  'data' | 'renderItem' | 'keyExtractor' | 'style' | 'contentContainerStyle'
> & {
  data: ReadonlyArray<ItemT>;
  renderItem:
    | ((props: { item: ItemT; index: number }) => React.ReactNode)
    | React.ComponentType<{ item: ItemT; index: number }>;
  keyExtractor?: (item: ItemT, index: number) => string;
};

export type LegendListProps<ItemT = unknown> =
  DataModeLegendListPropsOf<ItemT> & {
    /** Utility-first style shorthand applied to the content container. */
    sx?: SxInput;
    /** Style the list frame (flex, maxHeight, …). */
    frameSx?: SxInput;
    /**
     * When inside a padded shell, cancel edge padding so the scrollbar is flush.
     * Default `true`.
     */
    flushEdge?: boolean;
    /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
    dataSet?: ComponentDataSet;
  };

function requestsFlexFill(frameSx: SxInput): boolean {
  const flat = flattenSx(frameSx);
  return flat?.flex === 1 || flat?.flexGrow === 1;
}

function LegendListInner<ItemT>(
  {
    sx: sxProp,
    frameSx,
    dataSet,
    flushEdge = true,
    pointerEvents,
    ...rest
  }: LegendListProps<ItemT>,
  ref: Ref<ComponentRef<typeof RNLegendList>>
): ReactElement {
  const edge = useContentEdgePadding();
  const { contentSx, wrapperSx } = resolveFlushEdgeStyles(edge, flushEdge);
  const content = useHostSx('LegendList', [contentSx, sxProp], dataSet);
  const frame = useHostSx(
    'LegendListFrame',
    withPointerEvents(frameSx, pointerEvents)
  );
  const list = (
    <RNLegendList
      ref={ref}
      style={frame.style}
      contentContainerStyle={content.style}
      recycleItems
      drawDistance={250}
      estimatedItemSize={120}
      {...(rest as DataModeLegendListProps)}
      {...content.dataSet}
    />
  );
  if (wrapperSx === undefined) return list;
  const fill = requestsFlexFill(frameSx);
  return <Box sx={fill ? { ...wrapperSx, flex: 1 } : wrapperSx}>{list}</Box>;
}

export const LegendList = forwardRef(LegendListInner) as <ItemT>(
  props: LegendListProps<ItemT> & {
    ref?: Ref<ComponentRef<typeof RNLegendList>>;
  }
) => ReactElement;
