/**
 * `Chip` -- compact tag / filter element.
 *
 * Supports `selected` state and an optional `onPressIn` for toggle behavior.
 *
 * @example
 * ```tsx
 * <Chip label="React Native" selected={sel} onPressIn={() => setSel(!sel)} />
 * ```
 */

import { Pressable } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../text';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPressIn?: () => void;
  disabled?: boolean;
};

export function Chip({
  label,
  selected = false,
  onPressIn,
  disabled = false,
}: ChipProps) {
  const theme = useTheme();

  const bg = selected ? theme.colors.tint : 'transparent';
  const border = selected ? theme.colors.tint : theme.colors.outline;
  const textColor = selected ? theme.colors.surface : theme.colors.text;

  return (
    <Pressable
      onPressIn={onPressIn}
      disabled={disabled}
      style={({ pressed }) => [
        {
          alignSelf: 'flex-start' as const,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: border,
          backgroundColor: bg,
        },
        pressed && !disabled && { opacity: 0.7 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text
        style={{ color: textColor, fontSize: 14, fontWeight: '500' }}
        label={label}
      />
    </Pressable>
  );
}
