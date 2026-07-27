/**
 * Themed `FlatList` with `sx` applied to `contentContainerStyle`.
 */

import { forwardRef } from 'react';
import {
  FlatList as RNFlatList,
  type FlatListProps as RNFlatListProps,
} from 'react-native';
import {
  componentDataSet,
  type ComponentDataSet,
} from '../../component-id';
import { useTheme } from '../../theme';
import type { SxProps } from '../../theme';

export type FlatListProps<ItemT> = RNFlatListProps<ItemT> & {
  /** Utility-first style shorthand applied to `contentContainerStyle`. */
  sx?: SxProps;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- RN FlatList ref/component generics are invariant; item type flows via props
export const FlatList = forwardRef<RNFlatList<any>, FlatListProps<any>>(
  function FlatList(
    { sx: sxProp, contentContainerStyle, dataSet, ...rest },
    ref
  ) {
    const theme = useTheme();
    const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
    const idProps = componentDataSet('FlatList', dataSet);
    return (
      <RNFlatList
        ref={ref}
        contentContainerStyle={[sxStyle, contentContainerStyle]}
        {...rest}
        {...idProps}
      />
    );
  }
);
