/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { Text } from '../text';
import { Center } from './center';

export default function CenterExample(): JSX.Element {
  return (
    <ExampleRoot>
      <Center sx={{ height: 120, background: 'surface', borderRadius: 8 }}>
        <Text variant="body" label="Centered content" />
      </Center>

      <Center
        sx={{
          height: 120,
          background: 'tint',
          borderRadius: 12,
        }}
      >
        <Text
          variant="bodyBold"
          sx={{ color: 'onPrimary' }}
          label="Centered on tint"
        />
      </Center>
    </ExampleRoot>
  );
}
