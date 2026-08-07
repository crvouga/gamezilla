import { Text, useTheme } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { memo } from 'react';
import { View } from 'react-native';

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
  const theme = useTheme();
  return (
    <View
      style={{
        width: itemWidth,
        alignItems: 'center',
        justifyContent: 'flex-start',
      }}
    >
      <View
        style={{
          width: thumbSize,
          height: thumbSize,
          borderRadius: thumbSize / 2,
          borderWidth: 2,
          borderColor: theme.colors.border,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
      <Text
        variant="caption"
        numberOfLines={1}
        style={{
          marginTop: 4,
          fontSize: 9,
          textAlign: 'center',
          width: itemWidth - 4,
          opacity: 0.7,
          fontWeight: '400',
          color: theme.colors.text,
        }}
        label={caption}
      />
    </View>
  );
});
