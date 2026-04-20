import { useCommandPalette } from '@gamezilla/shared/ui';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

/**
 * iOS / Android: open the command palette with a **three-finger double tap** anywhere
 * on the main stack (web uses ⌘K / ⌘⇧P only; no icon button).
 */
export function CommandPaletteNativeGesture({
  children,
}: {
  children: ReactNode;
}) {
  const { open } = useCommandPalette();

  const gesture = useMemo(
    () =>
      Gesture.Tap()
        .minPointers(2)
        .numberOfTaps(3)
        .maxDelay(350)
        .onEnd(() => {
          open();
        }),
    [open]
  );

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.fill} collapsable={false}>
        {children}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
