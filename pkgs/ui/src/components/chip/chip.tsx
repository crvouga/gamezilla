/**
 * `Chip` -- compact tag / filter element.
 *
 * Unselected chips read as a quiet ghost button (outline + text). Selected
 * chips use the soft `tintSubtle` fill + `tint` text + `tint` border --
 * loud enough to communicate state without dominating a row of filters.
 *
 * @example
 * ```tsx
 * <Chip label="React Native" selected={sel} onPress={() => setSel(!sel)} />
 * ```
 */

import type { ReactNode } from 'react';
import { useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Pressable } from '../pressable';
import { Text } from '../text';

export type ChipProps = {
  label: ReactNode;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
};

export function Chip({
  label,
  selected = false,
  onPress,
  disabled = false,
}: ChipProps) {
  const theme = useTheme();

  const bg = selected ? theme.colors.tintSubtle : 'transparent';
  const border = selected ? theme.colors.tint : theme.colors.outline;
  const textColor = selected ? theme.colors.tint : theme.colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      sx={{ borderRadius: borderRadius.full }}
      style={{
        alignSelf: 'flex-start' as const,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: bg,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text
        style={{ color: textColor, fontSize: 13, fontWeight: '600' }}
        label={label}
      />
    </Pressable>
  );
}
