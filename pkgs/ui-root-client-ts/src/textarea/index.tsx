/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import { createEffect, createUniqueId, type JSX, on, Show } from 'solid-js';
import { useFormField } from '../form-field/index';
import { spaced } from '../layout-classes';

export type TextareaProps = {
  value: string;
  /** Every edit, with the new text. */
  onValueChange: (next: string) => void;
  /** Starting height in lines. Default 3. */
  rows?: number | undefined;
  /** Grow with the text instead of scrolling. */
  autoGrow?: boolean | undefined;
  /** Cap on the number of characters. */
  maxLength?: number | undefined;
  /** Show `length / maxLength` under the field. Needs `maxLength`. */
  showCount?: boolean | undefined;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  readOnly?: boolean | undefined;
  required?: boolean | undefined;
  /** Error styling and `aria-invalid`. Implied by an enclosing field's error. */
  invalid?: boolean | undefined;
  name?: string | undefined;
  /** Default: the enclosing `FormField`'s id. */
  id?: string | undefined;
  'aria-label'?: string | undefined;
  'aria-describedby'?: string | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
};

/** Height to fit the text; a dynamic value classes cannot express. */
function fitHeight(element: HTMLTextAreaElement): void {
  element.style.height = 'auto';
  element.style.height = `${element.scrollHeight}px`;
}

function TextareaCount(props: {
  id: string;
  length: number;
  max: number;
}): JSX.Element {
  return (
    <p
      class={spaced([
        'text textFootnote text-end',
        props.length >= props.max ? 'text-destructive' : 'text-text-secondary',
      ])}
      id={props.id}
      data-component={componentId('TextareaCount')}
    >
      {`${props.length} / ${props.max}`}
    </p>
  );
}

/**
 * `Textarea` -- a multi-line text field. It paints like `TextInput` (the
 * `.input` host: the control radius, the 3:1 `outline` edge, the keyboard
 * focus ring, the `destructive` edge when invalid) and
 * brings no label of its own: put it in a `FormField`, which it reads for
 * its `id`, `aria-describedby`, `aria-invalid` and `aria-required`, or name
 * it with `aria-label`.
 *
 * - `rows` sets the starting height; `autoGrow` lets it grow with the text
 *   (the user can still resize it when it does not).
 * - `maxLength` caps the text natively; `showCount` adds a quiet
 *   `12 / 280` counter under the field, read with the field's description.
 *
 * @example
 * ```tsx
 * <FormField label={t`Message`}>
 *   {() => <Textarea value={text()} onValueChange={setText} maxLength={280} showCount autoGrow />}
 * </FormField>
 * ```
 */
export function Textarea(props: TextareaProps): JSX.Element {
  const field = useFormField();
  const countId = `textarea-count-${createUniqueId()}`;
  let element: HTMLTextAreaElement | undefined;
  const counted = (): boolean =>
    props.showCount === true && props.maxLength !== undefined;
  const invalid = (): boolean =>
    props.invalid === true || field?.invalid === true;
  const describedBy = (): string | undefined => {
    const ids = spaced([
      props['aria-describedby'] ?? field?.describedBy,
      counted() ? countId : undefined,
    ]);
    return ids === '' ? undefined : ids;
  };
  createEffect(
    on(
      () => [props.value, props.autoGrow] as const,
      ([, autoGrow]) => {
        if (autoGrow === true && element !== undefined) fitHeight(element);
      }
    )
  );
  return (
    <div class="box gap-ui-xs" data-component={componentId('Textarea')}>
      <textarea
        ref={(el) => {
          element = el;
        }}
        class={spaced([
          'input inputTextarea text textBody px-ui-lg py-ui-sm',
          invalid() ? 'inputError' : undefined,
          props.autoGrow === true ? 'resize-none overflow-hidden' : undefined,
        ])}
        id={props.id ?? field?.id}
        name={props.name}
        rows={props.rows ?? 3}
        value={props.value}
        maxLength={props.maxLength}
        placeholder={props.placeholder}
        disabled={props.disabled === true}
        readOnly={props.readOnly === true}
        required={props.required === true || field?.required === true}
        data-testid={props.testId}
        aria-label={props['aria-label']}
        aria-describedby={describedBy()}
        aria-invalid={invalid() ? true : undefined}
        onInput={(event) => props.onValueChange(event.currentTarget.value)}
      />
      <Show when={counted() ? props.maxLength : undefined} keyed>
        {(max) => (
          <TextareaCount id={countId} length={props.value.length} max={max} />
        )}
      </Show>
    </div>
  );
}
