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
import { type ComponentDataSet, componentDataAttrs } from '../../component-id';
import { type SxInput, spacingScale, useThemeTokens } from '../../theme';
import { Box, joinClass } from '../box/box';
import styles from '../hosts.module.css';
import { Text } from '../text';

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
  /** Utility-first style shorthand for the outer wrapper. */
  sx?: SxInput | undefined;
  /** Style the field itself (height, font). */
  fieldSx?: SxInput | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
  ref?: ((el: HTMLInputElement | HTMLTextAreaElement) => void) | undefined;
};

/** Horizontal inset of the field text (`px: 4`). */
const FIELD_PX_STEP = 4;
/** Width reserved for a leading adornment (glyph + gap). */
const ADORNMENT_WIDTH_STEP = 7;
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
          {(text) => <Text variant="caption" label={text()} />}
        </Show>
      }
    >
      {(error) => (
        <Text
          variant="caption"
          role="alert"
          sx={{ color: 'destructive' }}
          label={error()}
        />
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
  | 'fieldSx'
  | 'ref'
  | 'class'
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
  const tokens = useThemeTokens();
  const fieldStyle = () =>
    tokens.css([
      {
        minHeight: FIELD_MIN_HEIGHT,
        py: 2,
        pl: props.hasAdornment ? ADORNMENT_WIDTH_STEP : FIELD_PX_STEP,
        pr: FIELD_PX_STEP,
        fontSize: 'base',
        lineHeight: 24,
      },
      props.fieldSx,
    ]);
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
      class={joinClass(
        styles['input'],
        props.hasError && styles['inputError'],
        props.multiline && styles['inputTextarea'],
        props.class
      )}
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
    <Box
      aria-hidden="true"
      sx={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        pl: FIELD_PX_STEP,
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      {props.children}
    </Box>
  );
}

export function TextInput(props: TextInputProps): JSX.Element {
  const [local, field, rest] = splitProps(
    props,
    ['label', 'error', 'helperText', 'startAdornment', 'sx', 'dataSet'],
    [
      'value',
      'onChangeText',
      'onSubmitEditing',
      'placeholder',
      'aria-label',
      'multiline',
      'rows',
      'secureTextEntry',
      'fieldSx',
      'ref',
      'class',
      'type',
      'onKeyDown',
    ]
  );
  const hasAdornment = () =>
    local.startAdornment !== undefined && local.startAdornment !== null;
  return (
    <Box
      sx={[{ gap: 1 }, local.sx]}
      dataSet={{ component: 'TextInput', ...local.dataSet }}
    >
      <Show when={local.label !== undefined}>
        <Text variant="label" as="label" label={local.label} />
      </Show>
      <Box sx={{ position: 'relative' }}>
        <Field
          {...field}
          hasError={local.error !== undefined}
          hasAdornment={hasAdornment()}
          rest={rest}
        />
        <Show when={hasAdornment()}>
          <StartAdornment>{local.startAdornment}</StartAdornment>
        </Show>
      </Box>
      <FieldFooter error={local.error} helperText={local.helperText} />
    </Box>
  );
}

export const TEXT_INPUT_ADORNMENT_INSET_PX = spacingScale(ADORNMENT_WIDTH_STEP);
