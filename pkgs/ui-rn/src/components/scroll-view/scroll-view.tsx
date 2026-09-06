/**
 * `ScrollView` -- themed scrollable container with `sx` prop.
 *
 * `sx` applies to the content container. `frameSx` styles the scroller host
 * (e.g. `flex: 1`). Inside a {@link ContentEdgePaddingProvider} shell,
 * horizontal and bottom padding are cancelled on the scroller and re-applied
 * on the content container so the scrollbar sits flush with the parent.
 */

import { forwardRef } from 'react';
import {
  ScrollView as RNScrollView,
  type ScrollViewProps as RNScrollViewProps,
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

export type ScrollViewProps = Omit<
  RNScrollViewProps,
  'style' | 'contentContainerStyle'
> & {
  /** Utility-first style shorthand applied to the content container. */
  sx?: SxInput;
  /** Style the scroller frame (flex, maxHeight, …). */
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

export const ScrollView = forwardRef<RNScrollView, ScrollViewProps>(
  function ScrollView(
    { sx: sxProp, frameSx, dataSet, flushEdge = true, pointerEvents, ...rest },
    ref
  ) {
    const edge = useContentEdgePadding();
    const { contentSx, wrapperSx } = resolveFlushEdgeStyles(edge, flushEdge);
    const content = useHostSx('ScrollView', [contentSx, sxProp], dataSet);
    const frame = useHostSx(
      'ScrollViewFrame',
      withPointerEvents(frameSx, pointerEvents)
    );
    const scroll = (
      <RNScrollView
        ref={ref}
        style={frame.style}
        contentContainerStyle={content.style}
        {...rest}
        {...content.dataSet}
      />
    );
    if (wrapperSx === undefined) return scroll;
    const fill = requestsFlexFill(frameSx);
    return (
      <Box sx={fill ? { ...wrapperSx, flex: 1 } : wrapperSx}>{scroll}</Box>
    );
  }
);
