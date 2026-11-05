import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { KeyHints } from './index';

/** A board's keyboard hint: the pointer's way, then the keys. */
export default function KeyHintsExample(): JSX.Element {
  return (
    <ExampleRoot>
      <KeyHints
        lead="Drag a number to its match."
        hints={[
          { keys: ['Enter'], label: 'start or end' },
          { keys: ['Arrows'], label: 'draw' },
          { keys: ['Esc'], label: 'cancel' },
          { keys: ['Del'], label: 'remove' },
        ]}
      />
    </ExampleRoot>
  );
}
