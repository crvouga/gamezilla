/** @jsxImportSource @solidjs/web */

import { Switch } from '@pkgs/ui-root-client-ts/switch';
import type { JSX } from '@solidjs/web';
import { createSignal } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

export default function SwitchExample(): JSX.Element {
  const [a, setA] = createSignal(false);
  const [b, setB] = createSignal(true);
  const [c, setC] = createSignal(false);

  return (
    <ExampleRoot>
      <div class="box flex-col gap-3">
        <Switch label="Notifications" value={a()} onValueChange={setA} />
        <Switch label="Sound effects" value={b()} onValueChange={setB} />
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
    </ExampleRoot>
  );
}
