import { ExampleRoot } from '../explorer/example-root';
import { Text } from '../text';
import { SafeAreaView } from './safe-area-view';

export default function SafeAreaViewExample() {
  return (
    <ExampleRoot>
      <SafeAreaView sx={{ background: 'surface', borderRadius: 8, p: 4 }}>
        <Text
          variant="body"
          label="Content inside a SafeAreaView respects device insets (notch, status bar, home indicator)."
        />
      </SafeAreaView>
    </ExampleRoot>
  );
}
