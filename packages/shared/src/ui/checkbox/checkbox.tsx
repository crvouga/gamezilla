/**
 * `Checkbox` -- a simple check toggle built with Pressable.
 *
 * Renders a bordered box with a checkmark character when checked.
 * No external icon library required.
 *
 * @example
 * ```tsx
 * <Checkbox label="Accept terms" checked={accepted} onToggle={setAccepted} />
 * ```
 */

import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../text';

export type CheckboxProps = {
  checked: boolean;
  onToggle: (next: boolean) => void;
  label?: string;
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
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 4,
          borderWidth: 2,
          borderColor: boxBorder,
          backgroundColor: boxBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked && (
          <Text
            style={{
              color: theme.colors.paper,
              fontSize: 14,
              fontWeight: 'bold',
              lineHeight: 16,
            }}
          >
            ✓
          </Text>
        )}
      </View>
      {label && <Text variant="body">{label}</Text>}
    </Pressable>
  );
}
