/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import {
  createContext,
  createUniqueId,
  type JSX,
  Show,
  useContext,
} from 'solid-js';
import { FieldLabel } from '../field-label/index';
import { spaced } from '../layout-classes';

/** What a field hands its control. Read reactively (getters). */
export type FormFieldControl = {
  readonly id: string;
  readonly labelId: string;
  /** Help and error ids, space-separated; `undefined` when neither shows. */
  readonly describedBy: string | undefined;
  readonly invalid: boolean;
  readonly required: boolean;
};

export type FormFieldProps = {
  label: JSX.Element;
  /** One line of help under the control. */
  help?: string | undefined;
  /** The error under the control; marks it invalid and is announced. */
  error?: string | undefined;
  /** Adds the required marker; pass `required` to the control as well. */
  required?: boolean | undefined;
  /** Quiet trailing label text, e.g. "optional". */
  hint?: JSX.Element | undefined;
  /**
   * The control is a group (`RadioGroup`, a set of checkboxes) that a
   * `<label>` cannot point at: it names itself with `labelId` instead.
   */
  group?: boolean | undefined;
  /** The control's id. Default generated. */
  id?: string | undefined;
  /** The control, given the ids and state that tie it to the field. */
  children: (control: FormFieldControl) => JSX.Element;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
};

const FormFieldContext = createContext<FormFieldControl | null>(null);

/** The enclosing `FormField`'s control wiring, or `null` outside one. */
export function useFormField(): FormFieldControl | null {
  return useContext(FormFieldContext);
}

function hasText(text: string | undefined): text is string {
  return text !== undefined && text !== '';
}

function createControl(props: FormFieldProps): FormFieldControl {
  const generated = `field-${createUniqueId()}`;
  const id = (): string => props.id ?? generated;
  return {
    get id() {
      return id();
    },
    get labelId() {
      return `${id()}-label`;
    },
    get describedBy() {
      const ids = spaced([
        hasText(props.help) ? `${id()}-help` : undefined,
        hasText(props.error) ? `${id()}-error` : undefined,
      ]);
      return ids === '' ? undefined : ids;
    },
    get invalid() {
      return hasText(props.error);
    },
    get required() {
      return props.required === true;
    },
  };
}

/**
 * `FormField` -- the frame around one form control: its label, an optional
 * line of help, and the error that replaces nothing (help stays, the error
 * is added below it and announced). The field hands its control everything
 * that ties them together through a render prop (and a context, so the
 * design system's own controls pick it up unasked):
 *
 * - `id`, which the label points at (`<label for>`);
 * - `labelId`, for a group control (`RadioGroup`, with `group` set) that
 *   is named with `aria-labelledby` because a `<label>` cannot name it;
 * - `describedBy`, the help and error ids for `aria-describedby`;
 * - `invalid` and `required`, for `aria-invalid` / `aria-required`.
 *
 * Wrap any control: `TextInput` (give it the `id` and no `label`), `Textarea`,
 * `Select`, `RadioGroup`, `Switch`.
 *
 * @example
 * ```tsx
 * <FormField label={t`Bio`} help={t`Shown on your profile.`} error={bioError()}>
 *   {(field) => <Textarea id={field.id} value={bio()} onValueChange={setBio} />}
 * </FormField>
 * ```
 */
export function FormField(props: FormFieldProps): JSX.Element {
  const control = createControl(props);
  return (
    <div
      class="box gap-ui-xs"
      data-testid={props.testId}
      data-component={componentId('FormField')}
      data-invalid={control.invalid ? 'true' : undefined}
    >
      <FieldLabel
        for={props.group === true ? undefined : control.id}
        id={control.labelId}
        required={props.required}
        hint={props.hint}
      >
        {props.label}
      </FieldLabel>
      <FormFieldContext.Provider value={control}>
        {props.children(control)}
      </FormFieldContext.Provider>
      <Show when={props.help} keyed>
        {(help) => (
          <p
            class="text textCaption text-text-secondary"
            id={`${control.id}-help`}
          >
            {help}
          </p>
        )}
      </Show>
      <Show when={props.error} keyed>
        {(error) => (
          <p
            class="text textCaption text-destructive"
            id={`${control.id}-error`}
            role="alert"
          >
            {error}
          </p>
        )}
      </Show>
    </div>
  );
}
