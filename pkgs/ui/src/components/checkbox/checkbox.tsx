/**
 * `Checkbox` -- a simple check toggle built with Pressable.
 *
 * Checked state fills the box with `tint` and renders the check in `onTint`
 * so it stays legible on both color schemes. Hover / press use Pressable's
 * default tint feedback (around the whole row).
 *
 * @example
 * ```tsx
 * <Checkbox label="Accept terms" checked={accepted} onToggle={setAccepted} />
 * ```
 */

import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Pressable } from '../pressable';
import { Text } from '../text';

export type CheckboxProps = {
  checked: boolean;
  onToggle: (next: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
};

export function Checkbox({
  checked,
  onToggle,
  label,
  disabled = false,
}: CheckboxProps) {
  const theme = useTheme();

  const boxBg = checked ? theme.colors.tint : 'transparent';
  const boxBorder = checked ? theme.colors.tint : theme.colors.outline;

  return (
    <Pressable
      onPress={() => !disabled && onToggle(!checked)}
      disabled={disabled}
      feedback="none"
      sx={{ borderRadius: borderRadius.xs }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: borderRadius.xs,
          borderWidth: 1.5,
          borderColor: boxBorder,
          backgroundColor: boxBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked && (
          <Text
            style={{
              color: theme.colors.onTint,
              fontSize: 13,
              fontWeight: '700',
              lineHeight: 15,
            }}
            label="✓"
          />
        )}
      </View>
      {label && <Text variant="body" label={label} />}
    </Pressable>
  );
}
