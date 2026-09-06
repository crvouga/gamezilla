/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { Stack } from '../stack';
import { Checkbox } from './checkbox';

export default function CheckboxExample(): JSX.Element {
  const [a, setA] = createSignal(false);
  const [b, setB] = createSignal(true);
  const [c, setC] = createSignal(false);

  return (
    <ExampleRoot>
      <SchemePreview>
        <Stack spacing={3}>
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
        </Stack>
      </SchemePreview>
    </ExampleRoot>
  );
}
