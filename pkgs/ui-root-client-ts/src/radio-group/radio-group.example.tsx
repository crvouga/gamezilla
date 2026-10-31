/** @jsxImportSource solid-js */

import { Radio, RadioGroup } from '@pkgs/ui-root-client-ts/radio-group';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

function Clock(props: {
  label: string;
  initial?: string;
  disabled?: boolean;
  orientation?: 'vertical' | 'horizontal';
}): JSX.Element {
  const [value, setValue] = createSignal<string | undefined>(props.initial);
  return (
    <RadioGroup
      aria-label={props.label}
      value={value()}
      onValueChange={setValue}
      disabled={props.disabled}
      orientation={props.orientation}
    >
      <Radio value="blitz" label="Blitz" description="5 minutes each" />
      <Radio value="rapid" label="Rapid" description="15 minutes each" />
      <Radio
        value="classical"
        label="Classical"
        description="An hour each"
        disabled
      />
      <Radio value="none" label="No clock" />
    </RadioGroup>
  );
}

export default function RadioGroupExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="Checked, with descriptions and a disabled option">
        <Clock label="Clock" initial="rapid" />
      </ExampleSection>
      <ExampleSection title="Nothing checked yet">
        <Clock label="Clock, unset" />
      </ExampleSection>
      <ExampleSection title="Horizontal">
        <Clock
          label="Clock, horizontal"
          initial="blitz"
          orientation="horizontal"
        />
      </ExampleSection>
      <ExampleSection title="Disabled group">
        <Clock label="Clock, disabled" initial="blitz" disabled />
      </ExampleSection>
    </ExampleRoot>
  );
}
