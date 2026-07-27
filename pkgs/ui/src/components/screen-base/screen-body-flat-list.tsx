/**
 * Full-bleed `FlatList` for nested lists inside a non-scrolling
 * {@link ScreenBase} body.
 *
 * Relies on {@link ContentEdgePaddingProvider} from the body shell so the
 * scrollbar sits flush with the screen edge. Prefer `ScreenBase` `scroll` when
 * the whole body scrolls; use this when sticky chrome sits above a scrolling
 * list.
 */

import { forwardRef } from 'react';
import type { FlatList as RNFlatList } from 'react-native';

import { Box } from '../box';
import { FlatList, type FlatListProps } from '../flat-list';

export type ScreenBodyFlatListProps<ItemT> = FlatListProps<ItemT>;

export const ScreenBodyFlatList = forwardRef<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RN FlatList ref/component generics are invariant; item type flows via props
  RNFlatList<any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RN FlatList ref/component generics are invariant; item type flows via props
  ScreenBodyFlatListProps<any>
>(function ScreenBodyFlatList({ style, ...rest }, ref) {
  return (
    <Box sx={{ flex: 1, minHeight: 0 }}>
      <FlatList ref={ref} style={[{ flex: 1 }, style]} {...rest} />
    </Box>
  );
});
