/**
 * Themed `FlatList` with `sx` applied to `contentContainerStyle`.
 */

import { forwardRef } from 'react';
import {
  FlatList as RNFlatList,
  type FlatListProps as RNFlatListProps,
} from 'react-native';
import { useTheme } from '../../theme';
import type { SxProps } from '../../theme';

export type FlatListProps<ItemT> = RNFlatListProps<ItemT> & {
  /** Utility-first style shorthand applied to `contentContainerStyle`. */
  sx?: SxProps;
};

export const FlatList = forwardRef<RNFlatList<any>, FlatListProps<any>>(
  function FlatList({ sx: sxProp, contentContainerStyle, ...rest }, ref) {
    const theme = useTheme();
    const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
    return (
      <RNFlatList
        ref={ref}
        contentContainerStyle={[sxStyle, contentContainerStyle]}
        {...rest}
      />
    );
  },
);
