/**
 * `ModalButton` -- action button used inside `ModalFooter`.
 */

import { Pressable } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../text';

export type ModalButtonProps = {
  label: string;
  variant?: 'default' | 'cancel' | 'destructive';
  onPress: () => void;
};

export function ModalButton({
  label,
  variant = 'default',
  onPress,
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
      onPress={onPress}
      style={({ pressed }) => [
        theme.sx({ py: 2, px: 4, borderRadius: 8 }),
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text variant="bodyBold" style={{ color }} label={label} />
    </Pressable>
  );
}
