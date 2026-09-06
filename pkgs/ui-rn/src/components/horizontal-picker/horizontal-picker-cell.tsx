import type { ReactNode } from 'react';
import { Box } from '../box';
import { Pressable } from '../pressable';

export type HorizontalPickerCellProps = {
  index: number;
  itemWidth: number;
  /** Unused — nuclear overhaul removes scroll-linked scale/opacity. */
  scrollX: unknown;
  onPress: () => void;
  children: ReactNode;
};

export function HorizontalPickerCell({
  itemWidth,
  onPress,
  children,
}: HorizontalPickerCellProps): ReactNode {
  return (
    <Pressable
      onPress={onPress}
      sx={{
        width: itemWidth,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box
        sx={{
          width: itemWidth,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </Box>
    </Pressable>
  );
}
