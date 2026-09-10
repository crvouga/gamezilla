/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';

export default function CenterExample(): JSX.Element {
  return (
    <ExampleRoot>
      <div class="box items-center justify-center h-[120px] bg-surface rounded-lg">
        <p class="text">{'Centered content'}</p>
      </div>

      <div class="box items-center justify-center h-[120px] bg-tint rounded-xl">
        <p class="text textBodyBold text-on-primary">{'Centered on tint'}</p>
      </div>
    </ExampleRoot>
  );
}
