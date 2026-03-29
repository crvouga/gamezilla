import type { PropsWithChildren } from 'react';

import { useTheme } from '@/@shared/theme';
import { ThemedView } from '@/ui/themed-view';

type ModalContentProps = PropsWithChildren<{
  style?: object;
}>;

export function ModalContent({ children, style }: ModalContentProps) {
  const theme = useTheme();

  return (
    <ThemedView
      style={[
        theme.sx({
          margin: 4,
          padding: 4,
          borderRadius: 12,
          maxWidth: 400,
          alignSelf: 'center',
        }),
        style,
      ]}
    >
      {children}
    </ThemedView>
  );
}
