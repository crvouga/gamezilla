import { PropsWithChildren, useState } from 'react';
import { TouchableOpacity } from 'react-native';

import { useTheme } from '@/@shared/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/ui/themed-text';
import { ThemedView } from '@/ui/themed-view';

export function Collapsible({
  children,
  title,
}: PropsWithChildren<{ title: string }>) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <ThemedView>
      <TouchableOpacity
        style={theme.sx({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 1.5,
        })}
        onPress={() => setIsOpen((value) => !value)}
        activeOpacity={0.8}
      >
        <IconSymbol
          name="chevron.right"
          size={18}
          weight="medium"
          color={theme.colors.icon}
          style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
        />
        <ThemedText type="defaultSemiBold">{title}</ThemedText>
      </TouchableOpacity>
      {isOpen && (
        <ThemedView style={theme.sx({ mt: 1.5, ml: 6 })}>{children}</ThemedView>
      )}
    </ThemedView>
  );
}
