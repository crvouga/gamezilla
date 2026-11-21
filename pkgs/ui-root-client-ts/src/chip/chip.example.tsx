/** @jsxImportSource solid-js */

import { Chip } from '@pkgs/ui-root-client-ts/chip';
import { ClockIcon } from '@pkgs/ui-root-client-ts/icons';
import { createSignal, For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

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
      <p class="text textCaption">
        {
          'Toggle chips (aria-pressed). Hover darkens the edge, Tab shows the focus ring; each 32px chip has a 44px hit area.'
        }
      </p>
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

          <div class="box flex-row flex-wrap gap-2">
            <Chip label="Unselected" />
            <Chip label="Selected" selected />
            <Chip label="Disabled" disabled />
            <Chip label="Disabled · selected" selected disabled />
          </div>

          <div class="box flex-row flex-wrap gap-2">
            <Chip label="5 min" startIcon={<ClockIcon size={16} />} />
            <Chip label="10 min" selected startIcon={<ClockIcon size={16} />} />
          </div>
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
