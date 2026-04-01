import { Box } from '../box';
import { Text } from '../text';
import { SafeAreaView } from './safe-area-view';

export default function SafeAreaViewExample() {
  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading">SafeAreaView</Text>

      <SafeAreaView sx={{ background: 'surface', borderRadius: 8, p: 4 }}>
        <Text variant="body">
          Content inside a SafeAreaView respects device insets (notch, status bar,
          home indicator).
        </Text>
      </SafeAreaView>
    </Box>
  );
}
