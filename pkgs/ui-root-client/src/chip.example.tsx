/** @jsxImportSource solid-js */
import { createSignal, For, type JSX } from 'solid-js';
import { Chip } from './chip';
import { ExampleRoot } from './example-root';
import { SchemePreview } from './scheme-preview';

const tags = ['Solid', 'TypeScript', 'Vite', 'Design System', 'UI'];

export default function ChipExample(): JSX.Element {
  const [selected, setSelected] = createSignal<ReadonlySet<string>>(
    new Set(['Vite'])
  );

  const toggle = (tag: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  return (
    <ExampleRoot>
      <SchemePreview>
        <div class="box flex-col gap-3">
          <div class="box flex-row gap-2 flex-wrap">
            <For each={tags}>
              {(tag) => (
                <Chip
                  label={tag}
                  selected={selected().has(tag)}
                  onClick={() => toggle(tag)}
                />
              )}
            </For>
          </div>

          <div class="box flex-row gap-2">
            <Chip label="Unselected" />
            <Chip label="Selected" selected />
            <Chip label="Disabled" disabled />
          </div>
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
