/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { SchemePreview } from './scheme-preview';
import { Switch } from './switch';

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
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
