/** @jsxImportSource solid-js */
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';

function ColorBox(props: { label: string; color: string }): JSX.Element {
  return (
    <div
      class="box p-3 rounded-lg min-w-16"
      style={{ 'background-color': `var(--ui-color-${props.color})` }}
    >
      <p class="text textCaption text-surface">{props.label}</p>
    </div>
  );
}

const WRAP_ITEMS = Array.from({ length: 8 }, (_, i) => `${i + 1}`);

export default function StackExample(): JSX.Element {
  return (
    <ExampleRoot class="gap-6">
      <div class="box gap-1">
        <label class="text textLabel">{'Vertical (default)'}</label>
        <div class="box flex-col gap-2">
          <ColorBox label="A" color="tint" />
          <ColorBox label="B" color="info" />
          <ColorBox label="C" color="success" />
        </div>
      </div>

      <div class="box gap-1">
        <label class="text textLabel">{'Horizontal'}</label>
        <div class="box flex-row gap-2">
          <ColorBox label="A" color="tint" />
          <ColorBox label="B" color="info" />
          <ColorBox label="C" color="success" />
        </div>
      </div>

      <div class="box gap-1">
        <label class="text textLabel">
          {'Horizontal, centered, space-between'}
        </label>
        <div class="box flex-row gap-2 items-center justify-between">
          <ColorBox label="Left" color="warning" />
          <ColorBox label="Right" color="destructive" />
        </div>
      </div>

      <div class="box gap-1">
        <label class="text textLabel">{'Wrap'}</label>
        <div class="box flex-row gap-2 flex-wrap">
          <For each={WRAP_ITEMS}>
            {(label) => <ColorBox label={label} color="tint" />}
          </For>
        </div>
      </div>
    </ExampleRoot>
  );
}
