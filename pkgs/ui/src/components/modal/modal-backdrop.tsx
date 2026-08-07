/**
 * `ModalBackdrop` -- semi-transparent overlay that dismisses on tap.
 *
 * Uses the active `scrim` token so light and dark schemes both get a
 * scene-appropriate backdrop (light mode: cool zinc dim; dark: deeper
 * near-black). Content area is centered and pointer-passthrough so taps
 * outside the modal hit the backdrop.
 *
 * Relies on a sized ancestor (e.g. {@link FocusTrap} / RN `Modal` with
 * `flex: 1`) so this fill expands to the viewport.
 */

import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { useTheme } from '../../theme';

export type ModalBackdropProps = PropsWithChildren<{
  onPress: () => void;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
}>;

export function ModalBackdrop({
  onPress,
  children,
  dataSet,
}: ModalBackdropProps) {
  const theme = useTheme();

  return (
    <View style={styles.root} {...componentDataSet('ModalBackdrop', dataSet)}>
      <Pressable
        onPress={onPress}
        style={[styles.scrim, { backgroundColor: theme.colors.scrim }]}
      />
      {/*
        pointerEvents must be a View prop — style.pointerEvents is ignored on
        RN Web, so the flex:1 centering layer would eat backdrop presses.
      */}
      <View pointerEvents="box-none" style={styles.center}>
        <View pointerEvents="auto">{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
