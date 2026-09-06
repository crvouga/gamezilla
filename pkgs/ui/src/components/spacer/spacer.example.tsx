/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { Box } from '../box';
import { ExampleRoot } from '../explorer/example-root';
import { Stack } from '../stack';
import { Text } from '../text';
import { Spacer } from './spacer';

export default function SpacerExample(): JSX.Element {
  return (
    <ExampleRoot>
      <Box sx={{ gap: 1 }}>
        <Text variant="label" label="Push items apart" />
        <Stack
          direction="horizontal"
          align="center"
          sx={{ p: 3, background: 'surface', borderRadius: 8 }}
        >
          <Text variant="body" label="Left" />
          <Spacer />
          <Text variant="body" label="Right" />
        </Stack>
      </Box>

      <Box sx={{ gap: 1 }}>
        <Text variant="label" label="Toolbar pattern" />
        <Stack
          direction="horizontal"
          align="center"
          spacing={2}
          sx={{ p: 3, background: 'surface', borderRadius: 8 }}
        >
          <Text variant="bodyBold" label="Title" />
          <Spacer />
          <Box sx={{ px: 3, py: 1, background: 'tint', borderRadius: 6 }}>
            <Text variant="label" sx={{ color: 'onPrimary' }} label="Action" />
          </Box>
        </Stack>
      </Box>
    </ExampleRoot>
  );
}
