/**
 * `Switch` -- themed toggle switch with optional label.
 *
 * @example
 * ```tsx
 * <Switch label="Dark mode" value={dark} onValueChange={setDark} />
 * ```
 */

import {
  Switch as RNSwitch,
  type SwitchProps as RNSwitchProps,
  View,
} from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../text';

export type SwitchProps = Omit<RNSwitchProps, 'trackColor' | 'thumbColor'> & {
  /** Optional label displayed next to the switch. */
  label?: string;
};

export function Switch({ label, ...rest }: SwitchProps) {
  const theme = useTheme();

  const track = {
    false: theme.colors.border,
    true: theme.colors.tint,
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <RNSwitch
        trackColor={track}
        thumbColor={theme.colors.surface}
        {...rest}
      />
      {label && <Text variant="body" label={label} />}
    </View>
  );
}
