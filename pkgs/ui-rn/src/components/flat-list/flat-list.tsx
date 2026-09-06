/**
 * Themed `FlatList` with `sx` applied to `contentContainerStyle`.
 *
 * `frameSx` styles the list host. Inside a {@link ContentEdgePaddingProvider}
 * shell, horizontal and bottom padding are cancelled on the list and
 * re-applied on the content container.
 */

import { forwardRef } from 'react';
import {
  FlatList as RNFlatList,
  type FlatListProps as RNFlatListProps,
} from 'react-native';
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

export type FlatListProps<ItemT> = Omit<
  RNFlatListProps<ItemT>,
  'style' | 'contentContainerStyle'
> & {
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

// biome-ignore lint/suspicious/noExplicitAny: RN FlatList ref/component generics are invariant; item type flows via props
export const FlatList = forwardRef<RNFlatList<any>, FlatListProps<any>>(
  function FlatList(
    { sx: sxProp, frameSx, dataSet, flushEdge = true, pointerEvents, ...rest },
    ref
  ) {
    const edge = useContentEdgePadding();
    const { contentSx, wrapperSx } = resolveFlushEdgeStyles(edge, flushEdge);
    const content = useHostSx('FlatList', [contentSx, sxProp], dataSet);
    const frame = useHostSx(
      'FlatListFrame',
      withPointerEvents(frameSx, pointerEvents)
    );
    const list = (
      <RNFlatList
        ref={ref}
        style={frame.style}
        contentContainerStyle={content.style}
        {...rest}
        {...content.dataSet}
      />
    );
    if (wrapperSx === undefined) return list;
    const fill = requestsFlexFill(frameSx);
    return <Box sx={fill ? { ...wrapperSx, flex: 1 } : wrapperSx}>{list}</Box>;
  }
);
