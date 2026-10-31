/** @jsxImportSource solid-js */

import type { LocalizedString } from '@pkgs/i18n-shared-ts/localized-string';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import {
  componentDataAttrs,
  dataAttrs,
} from '@pkgs/ui-root-shared-ts/component-id';
import { createUniqueId, type JSX, Show, splitProps } from 'solid-js';
import { bindElementTargets } from '../element-targets';
import type { FocusTarget } from '../focus';
import { spaced } from '../layout-classes';

/** `default` is the outlined field; `embedded` sits flush in a composed editor. */
export type TextInputVariant = 'default' | 'embedded';

export type TextInputProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  | 'class'
  | 'classList'
  | 'style'
  | 'placeholder'
  | 'aria-label'
  | 'value'
  | 'onInput'
  | 'children'
> & {
  value: string;
  /** Fires on every keystroke with the new value. */
  onChangeText: (next: string) => void;
  /** Fires on Enter (single line) / Cmd+Enter (multiline). */
  onSubmitEditing?: (() => void) | undefined;
  /** Label shown above the input. */
  label?: JSX.Element | undefined;
  /** Error message shown below the input. */
  error?: LocalizedString | undefined;
  /**
   * Error styling and `aria-invalid` without a message of its own — for a
   * field whose error is announced elsewhere (a form-level alert it points at
   * through `aria-describedby`). Implied by `error`.
   */
  invalid?: boolean | undefined;
  /** Helper text shown below the input (hidden when error is present). */
  helperText?: LocalizedString | undefined;
  placeholder?: LocalizedString | undefined;
  'aria-label'?: LocalizedString | undefined;
  /** Mask the value (`type="password"`). */
  secureTextEntry?: boolean | undefined;
  /**
   * Leading glyph inside the field (e.g. a search icon). Rendered
   * non-interactive; the text inset grows to make room.
   */
  startAdornment?: JSX.Element | undefined;
  /** Default `default`. */
  variant?: TextInputVariant | undefined;
  /** Claim the leftover width of a horizontal row. */
  grow?: boolean | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
  ref?: ((el: HTMLInputElement) => void) | undefined;
  /** From `createFocusTarget()`: lets the screen move focus to the field. */
  focusTarget?: FocusTarget | undefined;
};

function FieldFooter(props: {
  error: LocalizedString | undefined;
  helperText: LocalizedString | undefined;
}): JSX.Element {
  return (
    <Show
      when={props.error}
      fallback={
        <Show when={props.helperText}>
          {(text) => <p class="text textCaption">{text()}</p>}
        </Show>
      }
    >
      {(error) => (
        <p class="text textCaption text-destructive" role="alert">
          {error()}
        </p>
      )}
    </Show>
  );
}

type FieldLocal = Pick<
  TextInputProps,
  | 'value'
  | 'onChangeText'
  | 'onSubmitEditing'
  | 'placeholder'
  | 'aria-label'
  | 'secureTextEntry'
  | 'variant'
  | 'ref'
  | 'focusTarget'
  | 'type'
  | 'onKeyDown'
> & { hasError: boolean; hasAdornment: boolean };

function fieldType(local: FieldLocal): string {
  if (local.secureTextEntry) return 'password';
  return local.type ?? 'text';
}

function Field(
  props: FieldLocal & { rest: Record<string, unknown> }
): JSX.Element {
  const onKeyDown = (event: KeyboardEvent): void => {
    const handler = props.onKeyDown;
    if (typeof handler === 'function') {
      (handler as (e: KeyboardEvent) => void)(event);
    }
    if (event.key !== 'Enter' || props.onSubmitEditing === undefined) return;
    event.preventDefault();
    props.onSubmitEditing();
  };
  return (
    <input
      ref={(element) => {
        bindElementTargets(element, props);
        props.ref?.(element);
      }}
      class={spaced([
        // 44px tall, 16px text inset; a leading adornment (16px pad, ~20px
        // glyph, 8px gap) pushes the text to 44px (`pl-11`).
        'input min-h-11 py-2 pr-4 text-base',
        props.hasAdornment ? 'pl-11' : 'pl-4',
        props.hasError ? 'inputError' : undefined,
        props.variant === 'embedded'
          ? 'border-0 rounded-none bg-transparent textBodyBold'
          : undefined,
      ])}
      type={fieldType(props)}
      value={props.value}
      placeholder={props.placeholder}
      aria-label={props['aria-label']}
      aria-invalid={props.hasError || undefined}
      onInput={(event) => props.onChangeText(event.currentTarget.value)}
      onKeyDown={onKeyDown}
      {...componentDataAttrs('TextInputField', undefined)}
      {...props.rest}
    />
  );
}

function StartAdornment(props: { children: JSX.Element }): JSX.Element {
  return (
    <div
      class="box absolute inset-y-0 left-0 pl-4 items-center justify-center pointer-events-none"
      aria-hidden="true"
    >
      {props.children}
    </div>
  );
}

/**
 * `TextInput` -- styled text field with label, error, and helper text.
 *
 * A 44px field at the control radius inside the 3:1 `outline` edge (the
 * `.input` host): hover darkens the edge, keyboard focus draws the 2px
 * `focus-ring` 2px outside it, `disabled` fades it, and an error turns the
 * edge `destructive` with the message below (`role="alert"`) and
 * `aria-invalid`, so color never carries it alone. Multi-line text is
 * `Textarea`.
 *
 * - `variant="embedded"`: no border, fill or radius, emphasized text; for a
 *   field set into a composed editor (a title above the body).
 * - `grow`: claim the leftover width of a horizontal row.
 */
export function TextInput(props: TextInputProps): JSX.Element {
  const labelId = `field-label-${createUniqueId()}`;
  const [local, field, rest] = splitProps(
    props,
    [
      'label',
      'error',
      'invalid',
      'helperText',
      'startAdornment',
      'grow',
      'dataSet',
    ],
    [
      'value',
      'onChangeText',
      'onSubmitEditing',
      'placeholder',
      'aria-label',
      'secureTextEntry',
      'variant',
      'ref',
      'focusTarget',
      'type',
      'onKeyDown',
    ]
  );
  const hasAdornment = () =>
    local.startAdornment !== undefined && local.startAdornment !== null;
  return (
    <div
      class={spaced([
        'box',
        field.variant === 'embedded' ? undefined : 'gap-1',
        local.grow === true ? 'flex-1 min-w-0' : undefined,
      ])}
      {...dataAttrs({ component: 'TextInput', ...local.dataSet })}
    >
      <Show when={local.label !== undefined}>
        <label id={labelId} class="text textLabel">
          {local.label}
        </label>
      </Show>
      <div class="box relative">
        <Field
          {...field}
          hasError={local.error !== undefined || local.invalid === true}
          hasAdornment={hasAdornment()}
          rest={{
            ...rest,
            'aria-labelledby':
              rest['aria-labelledby'] ??
              (local.label !== undefined ? labelId : undefined),
          }}
        />
        <Show when={hasAdornment()}>
          <StartAdornment>{local.startAdornment}</StartAdornment>
        </Show>
      </div>
      <FieldFooter error={local.error} helperText={local.helperText} />
    </div>
  );
}
