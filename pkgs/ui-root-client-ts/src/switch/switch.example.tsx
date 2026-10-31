/** @jsxImportSource solid-js */

import { Switch } from '@pkgs/ui-root-client-ts/switch';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

export default function SwitchExample(): JSX.Element {
  const [a, setA] = createSignal(false);
  const [b, setB] = createSignal(true);
  const [c, setC] = createSignal(false);

  return (
    <ExampleRoot>
      <SchemePreview>
        <div class="box flex-col gap-3">
          <Switch label="Notifications" value={a()} onValueChange={setA} />
          <Switch label="Dark mode (on)" value={b()} onValueChange={setB} />
          <Switch label="Disabled" value={c()} onValueChange={setC} disabled />
          <Switch
            label="Disabled · on"
            value
            onValueChange={() => undefined}
            disabled
          />
          <Switch
            aria-label="Without a visible label"
            value={a()}
            onValueChange={setA}
          />
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
