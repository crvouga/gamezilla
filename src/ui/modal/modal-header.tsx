import type { PropsWithChildren } from 'react';

import { useTheme } from '@/@shared/theme';
import { ThemedText } from '@/ui/themed-text';
import { ThemedView } from '@/ui/themed-view';

type ModalHeaderProps = PropsWithChildren<{
  title: string;
}>;

export function ModalHeader({ title }: ModalHeaderProps) {
  const theme = useTheme();

  return (
    <ThemedView style={theme.sx({ mb: 3 })}>
      <ThemedText type="title">{title}</ThemedText>
    </ThemedView>
  );
}
