/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type { ColorTone } from '@pkgs/ui-root-shared-ts/token-names';
import { type JSX, Show } from 'solid-js';
import { spaced } from '../layout-classes';
import { toneClass } from '../text-classes';

export type FieldLabelProps = {
  /** The label text. */
  children?: JSX.Element | undefined;
  /** `id` of the control this labels. */
  for?: string | undefined;
  /** Marks the field as required with an asterisk. */
  required?: boolean | undefined;
  /** Quiet trailing text, e.g. "optional". */
  hint?: JSX.Element | undefined;
  tone?: ColorTone | undefined;
  /** Lets a control point back with `aria-labelledby`. */
  id?: string | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
};

/**
 * `FieldLabel` -- the `<label>` of a form control that does not bring its
 * own (`TextInput` does; pass it `label`). `for` is the control's `id`, so
 * pressing the label focuses the control and assistive technology reads the
 * two together.
 *
 * `required` adds the asterisk; the control still needs its own required
 * state. `hint` is quiet trailing text such as "optional".
 *
 * A label names a control. A heading over a group of controls is an `H*`;
 * a caption over a list is a `P`.
 *
 * @example
 * ```tsx
 * <StackVertical gap="xs">
 *   <FieldLabel for="clock" hint={t`optional`}>{t`Clock`}</FieldLabel>
 *   <Select id="clock" … />
 * </StackVertical>
 * ```
 */
export function FieldLabel(props: FieldLabelProps): JSX.Element {
  return (
    <label
      class={spaced([
        'text textLabel flex flex-row items-baseline gap-ui-xs',
        toneClass(props.tone),
      ])}
      for={props.for}
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('FieldLabel')}
    >
      {props.children}
      <Show when={props.required === true}>
        <span class="text-destructive" aria-hidden="true">
          {'*'}
        </span>
      </Show>
      <Show when={props.hint !== undefined && props.hint !== null}>
        <span class="textCaption">{props.hint}</span>
      </Show>
    </label>
  );
}
