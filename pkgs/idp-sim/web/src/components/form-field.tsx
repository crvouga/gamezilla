/**
 * The screens' text field: a design-system `TextInput` whose markup is the
 * source of truth.
 *
 * The same tree is serialized without JavaScript and read back by headless
 * walkers, so the field keeps what it was given as a real `value` attribute
 * (`attr:value`) and nothing mirrors keystrokes into state: submit handlers
 * read the form (`fieldValueOf`), exactly as a no-JS post would.
 */

import { asLocalized } from '@pkgs/i18n';
import { TextInput } from '@pkgs/ui/components/text-input';

import './jsx-attr-value';

export type FormFieldProps = {
  readonly testId: string;
  readonly name: string;
  readonly label: string;
  readonly value?: string | undefined;
  readonly secure?: boolean | undefined;
  readonly autocomplete?: string | undefined;
  readonly inputmode?: 'email' | 'text' | undefined;
  readonly invalid?: boolean | undefined;
  readonly describedBy?: string | undefined;
  readonly list?: string | undefined;
};

/** The DOM already holds what was typed; there is nothing to mirror. */
function keepTyping(): void {}

export function FormField(props: FormFieldProps) {
  return (
    <TextInput
      label={props.label}
      aria-label={asLocalized(props.label)}
      value={props.value ?? ''}
      attr:value={props.value ?? ''}
      onChangeText={keepTyping}
      secureTextEntry={props.secure === true}
      invalid={props.invalid === true}
      name={props.name}
      autocomplete={props.autocomplete}
      inputmode={props.inputmode}
      list={props.list}
      autofocus={props.invalid === true ? true : undefined}
      aria-describedby={props.describedBy}
      data-testid={props.testId}
    />
  );
}
