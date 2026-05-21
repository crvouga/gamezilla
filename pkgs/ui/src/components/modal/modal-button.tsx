/**
 * `ModalButton` -- action button used inside `ModalFooter`.
 */

import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import { useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Text } from '../text';

export type ModalButtonProps = {
  label: ReactNode;
  variant?: 'default' | 'cancel' | 'destructive';
  onPress: () => void;
  disabled?: boolean;
};

export function ModalButton({
  label,
  variant = 'default',
  onPress,
  disabled = false,
}: ModalButtonProps) {
  const theme = useTheme();

  const color =
    variant === 'destructive'
      ? theme.colors.destructive
      : variant === 'cancel'
        ? theme.colors.tint
        : theme.colors.text;

  return (
    <Pressable
      disabled={disabled}
      onPress={disabled ? () => {} : onPress}
      style={({ pressed }) => [
        theme.sx({ py: 2, px: 4, borderRadius: borderRadius.sm }),
        pressed && !disabled && { opacity: 0.7 },
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text variant="bodyBold" style={{ color }} label={label} />
    </Pressable>
  );
}
