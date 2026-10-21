/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { SchemePreview } from './scheme-preview';
import { SegmentedControl } from './segmented-control';

export default function SegmentedControlExample(): JSX.Element {
  const [mode, setMode] = createSignal('harness');
  const [size, setSize] = createSignal('md');

  return (
    <ExampleRoot>
      <SchemePreview>
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
      </SchemePreview>
    </ExampleRoot>
  );
}
