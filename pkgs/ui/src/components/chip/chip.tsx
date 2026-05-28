/**
 * `Chip` -- compact tag / filter element.
 *
 * Flat surface chip with a hairline border in both states:
 *   - Unselected reads as a quiet pill (`surface` fill + `border` outline +
 *     `text` foreground).
 *   - Selected lifts the brand color (`tintHighlight` fill + `tint` border +
 *     `tint` foreground) without feeling shouty next to its peers.
 *
 * Hover/press is delegated to {@link Pressable}'s tint overlay so the
 * interaction language matches every other pressable in the system.
 *
 * @example
 * ```tsx
 * <Chip label="React Native" selected={sel} onPress={() => setSel(!sel)} />
 * <Chip label="With icon" startIcon={<IconSymbol name="star" />} />
 * ```
 */

import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Pressable } from '../pressable';
import { Text } from '../text';

export type ChipProps = {
  label: ReactNode;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  /** Rendered before the label (sized to match the chip text). */
  startIcon?: ReactNode;
};

export function Chip({
  label,
  selected = false,
  onPress,
  disabled = false,
  startIcon,
}: ChipProps) {
  const theme = useTheme();

  const bg = selected ? theme.colors.tintHighlight : theme.colors.surface;
  const border = selected ? theme.colors.tint : theme.colors.border;
  const textColor = selected ? theme.colors.tint : theme.colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      sx={{ borderRadius: borderRadius.full }}
      style={{
        alignSelf: 'flex-start' as const,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: bg,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {startIcon !== undefined ? (
        <View
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            height: 16,
          }}
        >
          {startIcon}
        </View>
      ) : null}
      <Text
        style={{ color: textColor, fontSize: 13, fontWeight: '600' }}
        label={label}
      />
    </Pressable>
  );
}
