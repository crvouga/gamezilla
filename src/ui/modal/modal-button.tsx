import { Pressable } from 'react-native';

import { useTheme } from '@/@shared/theme';
import { ThemedText } from '@/ui/themed-text';

type ModalButtonProps = {
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
        pressed && theme.sx({ opacity: 0.7 }),
      ]}
    >
      <ThemedText
        style={[theme.sx({ fontSize: 16, fontWeight: '600' }), { color }]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}
