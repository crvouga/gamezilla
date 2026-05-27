/**
 * `Switch` -- themed toggle switch with optional label.
 *
 * Track color animates between `outline` (off) and `tint` (on); thumb stays
 * on the active scheme's `surfaceElevated` so it reads as a raised pebble
 * on both ramps.
 *
 * @example
 * ```tsx
 * <Switch label="Dark mode" value={dark} onValueChange={setDark} />
 * ```
 */

import type { ReactNode } from 'react';
import {
  Switch as RNSwitch,
  type SwitchProps as RNSwitchProps,
  View,
} from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../text';

export type SwitchProps = Omit<RNSwitchProps, 'trackColor' | 'thumbColor'> & {
  /** Optional label displayed next to the switch. */
  label?: ReactNode;
};

export function Switch({ label, ...rest }: SwitchProps) {
  const theme = useTheme();

  const track = {
    false: theme.colors.outline,
    true: theme.colors.tint,
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <RNSwitch
        trackColor={track}
        thumbColor={theme.colors.surfaceElevated}
        ios_backgroundColor={theme.colors.outline}
        {...rest}
      />
      {label && <Text variant="body" label={label} />}
    </View>
  );
}
