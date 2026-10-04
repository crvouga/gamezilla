/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { SegmentedControl } from './segmented-control';

export default function SegmentedControlExample(): JSX.Element {
  const [mode, setMode] = createSignal('harness');
  const [size, setSize] = createSignal('md');

  return (
    <ExampleRoot>
      <div class="box flex-col gap-4">
        <SegmentedControl
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
          segments={[
            { key: 'sm', label: 'Small' },
            { key: 'md', label: 'Medium' },
            { key: 'lg', label: 'Large' },
          ]}
          selected={size()}
          onSelect={setSize}
        />

        <p class="text textCaption">{`Selected: ${size()}`}</p>
      </div>
    </ExampleRoot>
  );
}
