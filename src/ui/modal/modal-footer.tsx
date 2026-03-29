import type { PropsWithChildren } from 'react';

import { useTheme } from '@/@shared/theme';
import { ThemedView } from '@/ui/themed-view';

export function ModalFooter({ children }: PropsWithChildren) {
  const theme = useTheme();

  return (
    <ThemedView
      style={theme.sx({
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 2,
      })}
    >
      {children}
    </ThemedView>
  );
}
