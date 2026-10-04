/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { Island } from './island';

export default function IslandExample(): JSX.Element {
  return (
    <ExampleRoot>
      <Island title="My Day" caption="Today's progress">
        <p class="text">{'Island body content.'}</p>
      </Island>
    </ExampleRoot>
  );
}
