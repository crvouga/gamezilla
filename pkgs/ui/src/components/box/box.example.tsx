/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';

export default function BoxExample(): JSX.Element {
  return (
    <ExampleRoot>
      <h3 class="text textHeading text-lg">{'Box'}</h3>

      <div class="box p-4 bg-surface rounded-lg">
        <p class="text text-text">{'Surface background'}</p>
      </div>

      <div class="box p-4 bg-surface border border-solid border-border rounded-xl">
        <p class="text text-text">{'With border'}</p>
      </div>

      <div class="box p-4 bg-tint rounded-lg">
        <p class="text text-on-primary font-semibold">{'Tint background'}</p>
      </div>

      <div class="box flex-row gap-2">
        <div class="box flex-1 p-3 bg-surface rounded-lg">
          <p class="text text-text text-sm">{'Flex 1'}</p>
        </div>
        <div class="box flex-[2] p-3 bg-surface rounded-lg">
          <p class="text text-text text-sm">{'Flex 2'}</p>
        </div>
      </div>
    </ExampleRoot>
  );
}
