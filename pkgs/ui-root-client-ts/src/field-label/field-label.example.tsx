/** @jsxImportSource solid-js */

import { FieldLabel } from '@pkgs/ui-root-client-ts/field-label';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

function Field(props: {
  id: string;
  children: (labelId: string) => JSX.Element;
}): JSX.Element {
  const [value, setValue] = createSignal('');
  const labelId = (): string => `${props.id}-label`;
  return (
    <StackVertical gap="xs">
      {props.children(labelId())}
      <TextInput
        id={props.id}
        value={value()}
        onChangeText={setValue}
        aria-labelledby={labelId()}
      />
    </StackVertical>
  );
}

export default function FieldLabelExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="for">
        <Field id="field-label-example-name">
          {(labelId) => (
            <FieldLabel for="field-label-example-name" id={labelId}>
              {'Display name'}
            </FieldLabel>
          )}
        </Field>
      </ExampleSection>
      <ExampleSection title="required">
        <Field id="field-label-example-email">
          {(labelId) => (
            <FieldLabel for="field-label-example-email" id={labelId} required>
              {'Email'}
            </FieldLabel>
          )}
        </Field>
      </ExampleSection>
      <ExampleSection title="hint">
        <Field id="field-label-example-bio">
          {(labelId) => (
            <FieldLabel
              for="field-label-example-bio"
              id={labelId}
              hint="optional"
            >
              {'Bio'}
            </FieldLabel>
          )}
        </Field>
      </ExampleSection>
      <ExampleSection title="tone">
        <Field id="field-label-example-code">
          {(labelId) => (
            <FieldLabel
              for="field-label-example-code"
              id={labelId}
              tone="secondary"
            >
              {'Invite code'}
            </FieldLabel>
          )}
        </Field>
      </ExampleSection>
    </ExampleRoot>
  );
}
