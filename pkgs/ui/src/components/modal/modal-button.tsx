/**
 * `ModalButton` -- action button used inside `ModalFooter`.
 */

import type { ReactNode } from 'react';
import { useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Pressable } from '../pressable';
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
      sx={{ py: 2, px: 4, borderRadius: borderRadius.md }}
      style={{
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Text variant="bodyBold" style={{ color }} label={label} />
    </Pressable>
  );
}
