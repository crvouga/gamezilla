import { Link } from 'expo-router';

import { useTheme } from '@gamezilla/shared/theme';
import { ThemedText } from '@/ui/themed-text';
import { ThemedView } from '@/ui/themed-view';

export default function ModalScreen() {
  const theme = useTheme();

  return (
    <ThemedView
      style={theme.sx({
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        p: 5,
      })}
    >
      <ThemedText type="title">This is a modal</ThemedText>
      <Link href="/" dismissTo style={theme.sx({ mt: 3.75, py: 3.75 })}>
        <ThemedText type="link">Go to home screen</ThemedText>
      </Link>
    </ThemedView>
  );
}
