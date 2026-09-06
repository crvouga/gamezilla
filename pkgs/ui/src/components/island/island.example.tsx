/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { Text } from '../text';
import { Island } from './island';

export default function IslandExample(): JSX.Element {
  return (
    <ExampleRoot>
      <Island title="My Day" caption="Today's progress">
        <Text variant="body" label="Island body content." />
      </Island>
    </ExampleRoot>
  );
}
