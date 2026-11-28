/** @jsxImportSource @solidjs/web */

import { SegmentedControl } from '@pkgs/ui-root-client-ts/segmented-control';
import type { JSX } from '@solidjs/web';
import { createSignal } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

export default function SegmentedControlExample(): JSX.Element {
  const [mode, setMode] = createSignal('harness');
  const [size, setSize] = createSignal('md');

  return (
    <ExampleRoot>
      <p class="text textCaption">
        {
          'One tab stop; the arrow keys move the selection. Unselected segments tint on hover.'
        }
      </p>

      <div class="box flex-col gap-4">
        <SegmentedControl
          aria-label="View"
          segments={[
            { key: 'harness', label: 'Harness' },
            { key: 'inspector', label: 'Inspector' },
            { key: 'docs', label: 'Docs' },
          ]}
          selected={mode()}
          onSelect={setMode}
        />

        <p class="text textCaption">{`Selected: ${mode()}`}</p>

        <SegmentedControl
          aria-label="Size"
          segments={[
            { key: 'sm', label: 'Small' },
            { key: 'md', label: 'Medium' },
            { key: 'lg', label: 'Large' },
          ]}
          selected={size()}
          onSelect={setSize}
        />

        <p class="text textCaption">{`Selected: ${size()}`}</p>

        <SegmentedControl
          aria-label="Disabled"
          segments={[
            { key: 'day', label: 'Day' },
            { key: 'week', label: 'Week' },
          ]}
          selected="week"
          onSelect={() => undefined}
          disabled
        />
      </div>
    </ExampleRoot>
  );
}
