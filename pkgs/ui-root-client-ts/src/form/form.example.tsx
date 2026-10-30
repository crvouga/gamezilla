/** @jsxImportSource solid-js */

import { Form } from '@pkgs/ui-root-client-ts/form';
import { FormField } from '@pkgs/ui-root-client-ts/form-field';
import { Pressable } from '@pkgs/ui-root-client-ts/pressable';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { Textarea } from '@pkgs/ui-root-client-ts/textarea';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

function SubmitButton(): JSX.Element {
  return (
    <Pressable
      type="submit"
      paddingX="lg"
      minHeight="control"
      radius="control"
      justify="center"
      self="start"
    >
      <Text variant="label">{'Send'}</Text>
    </Pressable>
  );
}

function ValidatedForm(props: { noValidate: boolean }): JSX.Element {
  const [note, setNote] = createSignal('');
  const [sent, setSent] = createSignal(0);
  return (
    <Form
      aria-label={props.noValidate ? 'Note, caller validates' : 'Note'}
      noValidate={props.noValidate}
      onSubmit={() => setSent((n) => n + 1)}
    >
      <FormField
        label="Note"
        required
        help="Required: an empty note does not submit."
      >
        {() => <Textarea value={note()} onValueChange={setNote} rows={2} />}
      </FormField>
      <SubmitButton />
      <P variant="caption">{`Submitted ${sent()} times`}</P>
    </Form>
  );
}

export default function FormExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="Native validation (required blocks an empty submit)">
        <ValidatedForm noValidate={false} />
      </ExampleSection>
      <ExampleSection title="noValidate, gap xl">
        <Form
          aria-label="Spaced form"
          noValidate
          gap="xl"
          onSubmit={() => undefined}
        >
          <FormField label="First">
            {() => (
              <Textarea value="" onValueChange={() => undefined} rows={1} />
            )}
          </FormField>
          <FormField label="Second">
            {() => (
              <Textarea value="" onValueChange={() => undefined} rows={1} />
            )}
          </FormField>
        </Form>
      </ExampleSection>
      <ExampleSection title="noValidate: the caller validates">
        <ValidatedForm noValidate />
      </ExampleSection>
    </ExampleRoot>
  );
}
