/**
 * `ModalBackdrop` -- semi-transparent overlay that dismisses on tap.
 *
 * Uses the active `scrim` token so light and dark schemes both get a
 * scene-appropriate backdrop (light mode: cool zinc dim; dark: deeper
 * near-black). Content area is centered and pointer-passthrough so taps
 * outside the modal hit the backdrop.
 */

import type { PropsWithChildren } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme';

export type ModalBackdropProps = PropsWithChildren<{
  onPress: () => void;
}>;

export function ModalBackdrop({ onPress, children }: ModalBackdropProps) {
  const theme = useTheme();

  return (
    <View style={theme.sx({ flex: 1 })}>
      <Pressable
        onPress={onPress}
        style={[
          theme.sx({
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }),
          { backgroundColor: theme.colors.scrim },
        ]}
      />
      {/*
        pointerEvents must be a View prop — style.pointerEvents is ignored on
        RN Web, so the flex:1 centering layer would eat backdrop presses.
      */}
      <View
        pointerEvents="box-none"
        style={theme.sx({
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        })}
      >
        <View pointerEvents="auto">{children}</View>
      </View>
    </View>
  );
}
