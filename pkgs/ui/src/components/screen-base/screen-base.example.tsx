/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { Box } from '../box';
import { ExampleRoot } from '../explorer/example-root';
import { Text } from '../text';
import { ScreenBase } from './screen-base';

export default function ScreenBaseExample(): JSX.Element {
  return (
    <ExampleRoot sx={{ flex: 1, minHeight: 400 }}>
      <ScreenBase
        screenId="screen-base-example"
        breadcrumbs={[
          { name: 'Design system', onClick: () => undefined },
          { name: 'ScreenBase' },
        ]}
        actions={[
          { type: 'secondary', label: 'Secondary', onClick: () => undefined },
          { type: 'submit', label: 'Primary', onClick: () => undefined },
        ]}
        scroll
        content={({ sx }) => (
          <Box sx={sx}>
            <Text
              variant="body"
              label="Body content uses fixed padding from ScreenBase. On desktop, content sits in a card island under the page header."
            />
          </Box>
        )}
      />
    </ExampleRoot>
  );
}
