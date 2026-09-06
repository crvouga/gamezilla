/** @jsxImportSource solid-js */
import { For, type JSX } from 'solid-js';
import { Box } from '../box';
import { ExampleRoot } from '../explorer/example-root';
import { Text } from '../text';
import { Stack } from './stack';

function ColorBox(props: { label: string; color: string }): JSX.Element {
  return (
    <Box sx={{ p: 3, background: props.color, borderRadius: 8, minWidth: 64 }}>
      <Text variant="caption" sx={{ color: 'surface' }} label={props.label} />
    </Box>
  );
}

const WRAP_ITEMS = Array.from({ length: 8 }, (_, i) => `${i + 1}`);

export default function StackExample(): JSX.Element {
  return (
    <ExampleRoot sx={{ gap: 6 }}>
      <Box sx={{ gap: 1 }}>
        <Text variant="label" label="Vertical (default)" />
        <Stack spacing={2}>
          <ColorBox label="A" color="tint" />
          <ColorBox label="B" color="info" />
          <ColorBox label="C" color="success" />
        </Stack>
      </Box>

      <Box sx={{ gap: 1 }}>
        <Text variant="label" label="Horizontal" />
        <Stack direction="horizontal" spacing={2}>
          <ColorBox label="A" color="tint" />
          <ColorBox label="B" color="info" />
          <ColorBox label="C" color="success" />
        </Stack>
      </Box>

      <Box sx={{ gap: 1 }}>
        <Text variant="label" label="Horizontal, centered, space-between" />
        <Stack
          direction="horizontal"
          spacing={2}
          align="center"
          justify="space-between"
        >
          <ColorBox label="Left" color="warning" />
          <ColorBox label="Right" color="destructive" />
        </Stack>
      </Box>

      <Box sx={{ gap: 1 }}>
        <Text variant="label" label="Wrap" />
        <Stack direction="horizontal" spacing={2} wrap>
          <For each={WRAP_ITEMS}>
            {(label) => <ColorBox label={label} color="tint" />}
          </For>
        </Stack>
      </Box>
    </ExampleRoot>
  );
}
