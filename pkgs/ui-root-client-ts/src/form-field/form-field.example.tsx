/** @jsxImportSource solid-js */

import { FormField } from '@pkgs/ui-root-client-ts/form-field';
import { Radio, RadioGroup } from '@pkgs/ui-root-client-ts/radio-group';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { Textarea } from '@pkgs/ui-root-client-ts/textarea';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

function NameField(props: { error?: string }): JSX.Element {
  const [name, setName] = createSignal('');
  return (
    <FormField
      label="Display name"
      required
      help="Shown to other players."
      error={props.error}
    >
      {(field) => (
        <TextInput
          id={field.id}
          aria-describedby={field.describedBy}
          invalid={field.invalid}
          required={field.required}
          value={name()}
          onChangeText={setName}
        />
      )}
    </FormField>
  );
}

function ClockField(): JSX.Element {
  const [clock, setClock] = createSignal<string | undefined>('blitz');
  return (
    <FormField label="Clock" group help="Applies to new games.">
      {() => (
        <RadioGroup value={clock()} onValueChange={setClock}>
          <Radio value="blitz" label="Blitz" />
          <Radio value="rapid" label="Rapid" />
        </RadioGroup>
      )}
    </FormField>
  );
}

export default function FormFieldExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="TextInput: label, required marker, help">
        <NameField />
      </ExampleSection>
      <ExampleSection title="Error (announced, marks the control invalid)">
        <NameField error="Pick a name with at least three letters." />
      </ExampleSection>
      <ExampleSection title="Textarea with a hint (reads the field from context)">
        <FormField label="Bio" hint="optional">
          {() => <Textarea value="" onValueChange={() => undefined} rows={2} />}
        </FormField>
      </ExampleSection>
      <ExampleSection title="A group control (RadioGroup) named by the label">
        <ClockField />
      </ExampleSection>
    </ExampleRoot>
  );
}
