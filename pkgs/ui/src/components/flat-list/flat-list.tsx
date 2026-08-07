/**
 * Themed `FlatList` with `sx` applied to `contentContainerStyle`.
 *
 * Inside a {@link ContentEdgePaddingProvider} shell, horizontal and bottom
 * padding are cancelled on the list and re-applied on `contentContainerStyle`
 * so the scrollbar sits flush with the parent surface edge. Pass
 * `flushEdge={false}` to opt out.
 *
 * When `style` includes `flex: 1`, the flush wrapper also fills so nested
 * screen-body lists stay height-bounded and actually scroll.
 */

import { forwardRef } from 'react';
import {
  FlatList as RNFlatList,
  type FlatListProps as RNFlatListProps,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { type ComponentDataSet, componentDataSet } from '../../component-id';
import type { SxProps } from '../../theme';
import { useTheme } from '../../theme';
import { Box } from '../box';
import {
  resolveFlushEdgeStyles,
  useContentEdgePadding,
} from '../content-edge-padding';

export type FlatListProps<ItemT> = RNFlatListProps<ItemT> & {
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

// biome-ignore lint/suspicious/noExplicitAny: RN FlatList ref/component generics are invariant; item type flows via props
export const FlatList = forwardRef<RNFlatList<any>, FlatListProps<any>>(
  function FlatList(
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
    const idProps = componentDataSet('FlatList', dataSet);
    const list = (
      <RNFlatList
        ref={ref}
        style={style}
        contentContainerStyle={[flushStyle, sxStyle, contentContainerStyle]}
        {...rest}
        {...idProps}
      />
    );
    if (wrapperSx === undefined) return list;
    const fill = styleRequestsFlexFill(style);
    return <Box sx={fill ? { ...wrapperSx, flex: 1 } : wrapperSx}>{list}</Box>;
  }
);
