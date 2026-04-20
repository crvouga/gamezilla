/**
 * `ModalBackdrop` -- semi-transparent overlay that dismisses on tap.
 */

import type { PropsWithChildren } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme';

export type ModalBackdropProps = PropsWithChildren<{
  onPressIn: () => void;
}>;

export function ModalBackdrop({ onPressIn, children }: ModalBackdropProps) {
  const theme = useTheme();

  return (
    <View style={theme.sx({ flex: 1 })}>
      <Pressable
        onPressIn={onPressIn}
        style={theme.sx({
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
        })}
      />
      <View
        style={[
          theme.sx({
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }),
          { pointerEvents: 'box-none' },
        ]}
      >
        <View style={{ pointerEvents: 'auto' }}>{children}</View>
      </View>
    </View>
  );
}
