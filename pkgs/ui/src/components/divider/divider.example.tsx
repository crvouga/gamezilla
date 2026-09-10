/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { Divider } from './divider';

export default function DividerExample(): JSX.Element {
  return (
    <ExampleRoot>
      <div class="box gap-1">
        <label class="text textLabel">{'Horizontal'}</label>
        <div class="box flex-col gap-3">
          <p class="text">{'Item above'}</p>
          <Divider />
          <p class="text">{'Item below'}</p>
        </div>
      </div>

      <div class="box gap-1">
        <label class="text textLabel">
          {'Vertical (inside horizontal stack)'}
        </label>
        <div class="box flex-row gap-3 items-center h-[40px]">
          <p class="text">{'Left'}</p>
          <Divider orientation="vertical" />
          <p class="text">{'Right'}</p>
        </div>
      </div>
    </ExampleRoot>
  );
}
