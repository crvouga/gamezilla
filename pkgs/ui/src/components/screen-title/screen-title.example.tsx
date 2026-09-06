/** @jsxImportSource solid-js */
import { For, type JSX } from 'solid-js';
import { Box } from '../box';
import { ExampleRoot } from '../explorer/example-root';
import { ScreenBase } from '../screen-base';
import { Text } from '../text';

const LINES = Array.from({ length: 12 }, (_, i) => i + 1);

export default function ScreenTitleExample(): JSX.Element {
  return (
    <ExampleRoot sx={{ flex: 1, minHeight: 400 }}>
      <ScreenBase
        screenId="screen-title-example"
        largeTitle
        breadcrumbs={[
          { name: 'Design system', onClick: () => undefined },
          { name: 'ScreenLargeTitle' },
        ]}
        scroll
        content={({ sx }) => (
          <Box sx={[sx, { gap: 3 }]}>
            <Text
              variant="caption"
              label="Scroll down — the TopBar title appears after the large title leaves the top."
            />
            <For each={LINES}>
              {(n) => (
                <Text variant="body" label={`Scroll content line ${n}`} />
              )}
            </For>
          </Box>
        )}
      />
    </ExampleRoot>
  );
}
