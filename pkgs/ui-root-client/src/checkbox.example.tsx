/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { Checkbox } from './checkbox';
import { ExampleRoot } from './example-root';
import { SchemePreview } from './scheme-preview';

export default function CheckboxExample(): JSX.Element {
  const [a, setA] = createSignal(false);
  const [b, setB] = createSignal(true);
  const [c, setC] = createSignal(false);

  return (
    <ExampleRoot>
      <SchemePreview>
        <div class="box flex-col gap-3">
          <Checkbox label="Accept terms" checked={a()} onToggle={setA} />
          <Checkbox
            label="Subscribe to newsletter"
            checked={b()}
            onToggle={setB}
          />
          <Checkbox label="Disabled" checked={c()} onToggle={setC} disabled />
          <Checkbox
            label="Indeterminate (partial)"
            checked={false}
            indeterminate
            onToggle={() => undefined}
          />
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
