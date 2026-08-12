import { Box, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { memo } from 'react';

export type AvatarPickerThumbProps = {
  itemWidth: number;
  thumbSize: number;
  caption: string;
  children: ReactNode;
};

/** Neutral ring + caption; Cover Flow scale/opacity conveys selection. */
export const AvatarPickerThumb = memo(function AvatarPickerThumb({
  itemWidth,
  thumbSize,
  caption,
  children,
}: AvatarPickerThumbProps): ReactNode {
  return (
    <Box
      sx={{
        width: itemWidth,
        alignItems: 'center',
        justifyContent: 'flex-start',
      }}
    >
      <Box
        sx={{
          width: thumbSize,
          height: thumbSize,
          borderRadius: thumbSize / 2,
          borderWidth: 2,
          borderColor: 'border',
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </Box>
      <Text
        variant="caption"
        numberOfLines={1}
        sx={{
          marginTop: 4,
          fontSize: 9,
          textAlign: 'center',
          width: itemWidth - 4,
          opacity: 0.7,
          fontWeight: '400',
          color: 'text',
        }}
        label={caption}
      />
    </Box>
  );
});
