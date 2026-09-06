/**
 * `Switch` -- themed toggle switch with optional label.
 *
 * Track color animates between `outline` (off) and `tint` (on); the thumb
 * stays `onPrimary` (white in both schemes) so it reads as a high-contrast
 * raised pebble against both the neutral off-track and the saturated on-track.
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
} from 'react-native';
import type { ComponentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { Box } from '../box';
import { Text } from '../text';

export type SwitchProps = Omit<RNSwitchProps, 'trackColor' | 'thumbColor'> & {
  /** Optional label displayed next to the switch. */
  label?: ReactNode;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function Switch({ label, dataSet, ...rest }: SwitchProps) {
  const theme = useTheme();

  const track = {
    false: theme.colors.outline,
    true: theme.colors.tint,
  };

  return (
    <Box
      dataSet={{ component: 'Switch', ...dataSet }}
      sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
    >
      <RNSwitch
        trackColor={track}
        thumbColor={theme.colors.onPrimary}
        ios_backgroundColor={theme.colors.outline}
        {...rest}
      />
      {label && <Text variant="body" label={label} />}
    </Box>
  );
}
