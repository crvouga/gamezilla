/** @jsxImportSource solid-js */
/**
 * `TextInput` -- styled text field with label, error, and helper text.
 *
 * Flat surface field; focus renders a tint ring via `:focus-visible`, errors
 * switch the border to `destructive`. `multiline` renders a `<textarea>`.
 */

import type { LocalizedString } from '@pkgs/i18n';
import { type JSX, Show, splitProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import {
  type ComponentDataSet,
  componentDataAttrs,
  dataAttrs,
} from '../../component-id';
import { spacingScale } from '../../theme';

export type TextInputProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  'style' | 'placeholder' | 'aria-label' | 'value' | 'onInput' | 'children'
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
  /** Render a resizable `<textarea>`. */
  multiline?: boolean | undefined;
  /** Initial textarea rows. */
  rows?: number | undefined;
  /** Mask the value (`type="password"`). */
  secureTextEntry?: boolean | undefined;
  /**
   * Leading glyph inside the field (e.g. a search icon). Rendered
   * non-interactive; the text inset grows to make room.
   */
  startAdornment?: JSX.Element | undefined;
  /** Extra classes on the outer wrapper. */
  class?: string | undefined;
  /** Inline styles on the outer wrapper. */
  style?: JSX.CSSProperties | undefined;
  /** Extra classes on the field itself. */
  fieldClass?: string | undefined;
  /** Inline styles on the field itself. */
  fieldStyle?: JSX.CSSProperties | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
  ref?: ((el: HTMLInputElement | HTMLTextAreaElement) => void) | undefined;
};

/** Horizontal inset of the field text (`px: 4` → 16px). */
const FIELD_PX_STEP = 4;
/**
 * Total left inset when a leading adornment is present.
 * Must clear: field pad (16px) + ~18px glyph + ~8px gap → 44px (`11 * 4`).
 * Smaller values put placeholder/text under the icon.
 */
const ADORNMENT_WIDTH_STEP = 11;
const FIELD_MIN_HEIGHT = 44;

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
  | 'multiline'
  | 'rows'
  | 'secureTextEntry'
  | 'fieldClass'
  | 'fieldStyle'
  | 'ref'
  | 'type'
  | 'onKeyDown'
> & { hasError: boolean; hasAdornment: boolean };

function fieldType(local: FieldLocal): string | undefined {
  if (local.multiline) return undefined;
  if (local.secureTextEntry) return 'password';
  return local.type ?? 'text';
}

function Field(
  props: FieldLocal & { rest: Record<string, unknown> }
): JSX.Element {
  const fieldStyle = (): JSX.CSSProperties => ({
    'min-height': `${FIELD_MIN_HEIGHT}px`,
    'padding-top': `${spacingScale(2)}px`,
    'padding-bottom': `${spacingScale(2)}px`,
    'padding-left': `${spacingScale(props.hasAdornment ? ADORNMENT_WIDTH_STEP : FIELD_PX_STEP)}px`,
    'padding-right': `${spacingScale(FIELD_PX_STEP)}px`,
    'font-size': 'var(--ui-font-size-base)',
    'line-height': '24px',
    ...props.fieldStyle,
  });
  const onKeyDown = (event: KeyboardEvent): void => {
    const handler = props.onKeyDown;
    if (typeof handler === 'function') {
      (handler as (e: KeyboardEvent) => void)(event);
    }
    if (event.key !== 'Enter' || props.onSubmitEditing === undefined) return;
    if (props.multiline && !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    props.onSubmitEditing();
  };
  return (
    <Dynamic
      component={props.multiline ? 'textarea' : 'input'}
      ref={props.ref}
      class={[
        'input',
        props.hasError ? 'inputError' : undefined,
        props.multiline ? 'inputTextarea' : undefined,
        props.fieldClass,
      ]
        .filter(Boolean)
        .join(' ')}
      style={fieldStyle()}
      type={fieldType(props)}
      rows={props.multiline ? (props.rows ?? 3) : undefined}
      value={props.value}
      placeholder={props.placeholder}
      aria-label={props['aria-label']}
      aria-invalid={props.hasError || undefined}
      onInput={(event: InputEvent) =>
        props.onChangeText((event.currentTarget as HTMLInputElement).value)
      }
      onKeyDown={onKeyDown}
      {...componentDataAttrs('TextInputField', undefined)}
      {...props.rest}
    />
  );
}

function StartAdornment(props: { children: JSX.Element }): JSX.Element {
  return (
    <div
      class="box absolute inset-y-0 left-0 items-center justify-center pointer-events-none"
      aria-hidden="true"
      style={{ 'padding-left': `${spacingScale(FIELD_PX_STEP)}px` }}
    >
      {props.children}
    </div>
  );
}

export function TextInput(props: TextInputProps): JSX.Element {
  const [local, field, rest] = splitProps(
    props,
    [
      'label',
      'error',
      'invalid',
      'helperText',
      'startAdornment',
      'class',
      'style',
      'dataSet',
    ],
    [
      'value',
      'onChangeText',
      'onSubmitEditing',
      'placeholder',
      'aria-label',
      'multiline',
      'rows',
      'secureTextEntry',
      'fieldClass',
      'fieldStyle',
      'ref',
      'type',
      'onKeyDown',
    ]
  );
  const hasAdornment = () =>
    local.startAdornment !== undefined && local.startAdornment !== null;
  return (
    <div
      class={['box gap-1', local.class].filter(Boolean).join(' ')}
      {...dataAttrs({ component: 'TextInput', ...local.dataSet })}
      style={local.style}
    >
      <Show when={local.label !== undefined}>
        <label class="text textLabel">{local.label}</label>
      </Show>
      <div class="box relative">
        <Field
          {...field}
          hasError={local.error !== undefined || local.invalid === true}
          hasAdornment={hasAdornment()}
          rest={rest}
        />
        <Show when={hasAdornment()}>
          <StartAdornment>{local.startAdornment}</StartAdornment>
        </Show>
      </div>
      <FieldFooter error={local.error} helperText={local.helperText} />
    </div>
  );
}

export const TEXT_INPUT_ADORNMENT_INSET_PX = spacingScale(ADORNMENT_WIDTH_STEP);
