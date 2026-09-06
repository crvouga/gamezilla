/** @jsxImportSource solid-js */
import { For, type JSX } from 'solid-js';
import { Box } from '../box';
import { ExampleRoot } from '../explorer/example-root';
import { Text } from '../text';
import { ScrollView } from './scroll-view';

const ITEMS = Array.from({ length: 20 }, (_, i) => i + 1);

export default function ScrollViewExample(): JSX.Element {
  return (
    <ExampleRoot>
      <Box
        sx={{
          height: 200,
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: 'border',
          borderRadius: 8,
        }}
      >
        <ScrollView sx={{ p: 3, gap: 2 }}>
          <For each={ITEMS}>
            {(n) => (
              <Box sx={{ p: 3, background: 'surface', borderRadius: 6 }}>
                <Text variant="body" label={`Item ${n}`} />
              </Box>
            )}
          </For>
        </ScrollView>
      </Box>
    </ExampleRoot>
  );
}
