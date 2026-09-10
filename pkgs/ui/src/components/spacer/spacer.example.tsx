/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';

export default function SpacerExample(): JSX.Element {
  return (
    <ExampleRoot>
      <div class="box gap-1">
        <label class="text textLabel">{'Push items apart'}</label>
        <div class="box flex-row items-center p-3 bg-surface rounded-lg">
          <p class="text">{'Left'}</p>
          <div class="box flex-1" aria-hidden="true" />
          <p class="text">{'Right'}</p>
        </div>
      </div>

      <div class="box gap-1">
        <label class="text textLabel">{'Toolbar pattern'}</label>
        <div class="box flex-row gap-2 items-center p-3 bg-surface rounded-lg">
          <p class="text textBodyBold">{'Title'}</p>
          <div class="box flex-1" aria-hidden="true" />
          <div class="box px-3 py-1 bg-tint rounded-md">
            <label class="text textLabel text-on-primary">{'Action'}</label>
          </div>
        </div>
      </div>
    </ExampleRoot>
  );
}
