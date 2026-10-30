/** @jsxImportSource solid-js */

import { Checkbox } from '@pkgs/ui-root-client-ts/checkbox';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

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
            label="Disabled · checked"
            checked
            onToggle={() => undefined}
            disabled
          />
          <Checkbox
            aria-label="Without a visible label"
            checked={a()}
            onToggle={setA}
          />
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
