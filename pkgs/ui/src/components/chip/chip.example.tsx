/** @jsxImportSource solid-js */
import { createSignal, For, type JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { Stack } from '../stack';
import { Chip } from './chip';

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
        <Stack spacing={3}>
          <Stack direction="horizontal" spacing={2} wrap>
            <For each={tags}>
              {(tag) => (
                <Chip
                  label={tag}
                  selected={selected().has(tag)}
                  onClick={() => toggle(tag)}
                />
              )}
            </For>
          </Stack>

          <Stack direction="horizontal" spacing={2}>
            <Chip label="Unselected" />
            <Chip label="Selected" selected />
            <Chip label="Disabled" disabled />
          </Stack>
        </Stack>
      </SchemePreview>
    </ExampleRoot>
  );
}
