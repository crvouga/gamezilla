import type { PropsWithChildren } from 'react';

import { useTheme } from '@/@shared/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type ModalBodyProps = PropsWithChildren<{
  message: string;
}>;

export function ModalBody({ message }: ModalBodyProps) {
  const theme = useTheme();

  return (
    <ThemedView style={theme.sx({ mb: 4 })}>
      <ThemedText>{message}</ThemedText>
    </ThemedView>
  );
}
