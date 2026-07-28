/**
 * `ScrollView` -- themed scrollable container with `sx` prop.
 *
 * Inside a {@link ContentEdgePaddingProvider} shell, horizontal and bottom
 * padding are cancelled on the scroller and re-applied on
 * `contentContainerStyle` so the scrollbar sits flush with the parent surface
 * edge. Pass `flushEdge={false}` to opt out.
 *
 * When `style` includes `flex: 1`, the flush wrapper also fills so nested
 * screen-body scrollers stay height-bounded and actually scroll.
 *
 * @example
 * ```tsx
 * <ScrollView sx={{ flex: 1, p: 4 }}>
 *   <Text>Scrollable content</Text>
 * </ScrollView>
 * ```
 */

import { forwardRef } from 'react';
import {
  ScrollView as RNScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type ScrollViewProps as RNScrollViewProps,
} from 'react-native';
import { componentDataSet, type ComponentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import type { SxProps } from '../../theme';
import { Box } from '../box';
import {
  resolveFlushEdgeStyles,
  useContentEdgePadding,
} from '../content-edge-padding';

export type ScrollViewProps = RNScrollViewProps & {
  /** Utility-first style shorthand applied to `contentContainerStyle`. */
  sx?: SxProps;
  /**
   * When inside a padded shell, cancel edge padding so the scrollbar is flush.
   * Default `true`.
   */
  flushEdge?: boolean;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

function styleRequestsFlexFill(
  style: StyleProp<ViewStyle> | undefined
): boolean {
  const flat = StyleSheet.flatten(style);
  return flat?.flex === 1 || flat?.flexGrow === 1;
}

export const ScrollView = forwardRef<RNScrollView, ScrollViewProps>(
  function ScrollView(
    {
      sx: sxProp,
      contentContainerStyle,
      dataSet,
      flushEdge = true,
      style,
      ...rest
    },
    ref
  ) {
    const theme = useTheme();
    const edge = useContentEdgePadding();
    const { contentSx, wrapperSx } = resolveFlushEdgeStyles(edge, flushEdge);
    const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
    const flushStyle = contentSx ? theme.sx(contentSx) : undefined;
    const idProps = componentDataSet('ScrollView', dataSet);
    const scroll = (
      <RNScrollView
        ref={ref}
        style={style}
        contentContainerStyle={[flushStyle, sxStyle, contentContainerStyle]}
        {...rest}
        {...idProps}
      />
    );
    if (wrapperSx === undefined) return scroll;
    const fill = styleRequestsFlexFill(style);
    return (
      <Box sx={fill ? { ...wrapperSx, flex: 1 } : wrapperSx}>{scroll}</Box>
    );
  }
);
