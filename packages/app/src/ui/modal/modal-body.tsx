import type { PropsWithChildren } from 'react';

import { useTheme } from '@gamezilla/shared/theme';
import { ThemedText } from '@/ui/themed-text';
import { ThemedView } from '@/ui/themed-view';

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
