/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { NumberStepper } from './number-stepper';

export default function NumberStepperExample(): JSX.Element {
  const [n, setN] = createSignal(5);

  return (
    <ExampleRoot>
      <NumberStepper
        label="Count"
        value={n()}
        onChange={setN}
        min={0}
        max={20}
      />
      <p class="text textCaption opacity-75">{`Value: ${n()}`}</p>
    </ExampleRoot>
  );
}
