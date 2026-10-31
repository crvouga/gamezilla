/** @jsxImportSource solid-js */

import { NumberStepper } from '@pkgs/ui-root-client-ts/number-stepper';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

export default function NumberStepperExample(): JSX.Element {
  const [players, setPlayers] = createSignal(4);
  const [rating, setRating] = createSignal(1500);

  return (
    <ExampleRoot>
      <p class="text textCaption">
        {
          'Tab to the value, then the arrow keys step it and Home / End jump to the bounds. At a bound its button is disabled and the reason is announced.'
        }
      </p>
      <SchemePreview>
        <div class="box gap-4">
          <NumberStepper
            label="Players"
            value={players()}
            onChange={setPlayers}
            min={2}
            max={8}
          />
          <p class="text textCaption">{`Players: ${players()}`}</p>
          <NumberStepper
            label="Rating"
            value={rating()}
            onChange={setRating}
            min={800}
            max={2800}
            step={50}
          />
          <NumberStepper
            label="At minimum"
            value={2}
            onChange={() => undefined}
            min={2}
            max={8}
          />
          <NumberStepper
            label="At maximum"
            value={8}
            onChange={() => undefined}
            min={2}
            max={8}
          />
          <NumberStepper
            label="Disabled"
            value={4}
            onChange={() => undefined}
            min={2}
            max={8}
            disabled
          />
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
