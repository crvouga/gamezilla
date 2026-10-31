/** @jsxImportSource solid-js */

import { FormField } from '@pkgs/ui-root-client-ts/form-field';
import { Textarea } from '@pkgs/ui-root-client-ts/textarea';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

function Editable(props: {
  initial?: string;
  autoGrow?: boolean;
  maxLength?: number;
  showCount?: boolean;
  label: string;
}): JSX.Element {
  const [value, setValue] = createSignal(props.initial ?? '');
  return (
    <Textarea
      aria-label={props.label}
      value={value()}
      onValueChange={setValue}
      autoGrow={props.autoGrow}
      maxLength={props.maxLength}
      showCount={props.showCount}
      placeholder="Write something"
    />
  );
}

export default function TextareaExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="Default (3 rows)">
        <Editable label="Default" />
      </ExampleSection>
      <ExampleSection title="Auto-grow">
        <Editable
          label="Auto-grow"
          autoGrow
          initial={'One\nTwo\nThree\nFour'}
        />
      </ExampleSection>
      <ExampleSection title="maxLength with counter">
        <Editable
          label="Bio"
          maxLength={80}
          showCount
          initial="Plays blitz on weekends."
        />
      </ExampleSection>
      <ExampleSection title="Inside a FormField with help and error">
        <FormField
          label="Message"
          help="Shown to the host."
          error="Write a message first."
        >
          {() => <Textarea value="" onValueChange={() => undefined} />}
        </FormField>
      </ExampleSection>
      <ExampleSection title="Invalid without a message">
        <Textarea
          aria-label="Invalid"
          value=""
          onValueChange={() => undefined}
          invalid
        />
      </ExampleSection>
      <ExampleSection title="Disabled and read-only">
        <Textarea
          aria-label="Disabled"
          value="Disabled text"
          onValueChange={() => undefined}
          disabled
          rows={2}
        />
        <Textarea
          aria-label="Read-only"
          value="Read-only text"
          onValueChange={() => undefined}
          readOnly
          rows={2}
        />
      </ExampleSection>
    </ExampleRoot>
  );
}
