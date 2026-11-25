/** @jsxImportSource @solidjs/web */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import {
  Radio as SdkRadio,
  RadioGroup as SdkRadioGroup,
} from '@ui-sdk/solid/radio';
import { createUniqueId, Show } from 'solid-js';
import { useFormField } from '../form-field/index';
import { spaced } from '../layout-classes';

export type RadioGroupProps = {
  /** The checked option, or `undefined` when none is. */
  value: string | undefined;
  onValueChange: (value: string) => void;
  /** The `Radio` options. */
  children: JSX.Element;
  /** Disable every option. */
  disabled?: boolean | undefined;
  /** Default `vertical`. */
  orientation?: 'vertical' | 'horizontal' | undefined;
  /** Default: the enclosing `FormField`'s id. */
  id?: string | undefined;
  'aria-label'?: string | undefined;
  /** Default: the enclosing `FormField`'s label. */
  'aria-labelledby'?: string | undefined;
  'aria-describedby'?: string | undefined;
  'aria-invalid'?: boolean | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
};

export type RadioProps = {
  value: string;
  label: string;
  /** Quiet second line, read with the label. */
  description?: string | undefined;
  disabled?: boolean | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
};

/**
 * `RadioGroup` + `Radio` -- one choice from a short list, every option in
 * view (the WAI-ARIA radio group pattern). A longer list is a `Select`; two
 * or three modes of one view are a `SegmentedControl`.
 *
 * - The group is one tab stop: the checked radio, or the first enabled one
 *   when none is checked.
 * - Arrow keys move to the next or previous enabled radio, wrapping, and
 *   check it. Space checks the focused radio.
 * - Each radio has a label and an optional description, read with it.
 * - Name the group with `aria-label`, or put it in a `FormField` with
 *   `group` set, which names it with its label.
 *
 * @example
 * ```tsx
 * <RadioGroup value={clock()} onValueChange={setClock} aria-label={t`Clock`}>
 *   <Radio value="blitz" label={t`Blitz`} description={t`5 minutes each`} />
 *   <Radio value="rapid" label={t`Rapid`} description={t`15 minutes each`} />
 *   <Radio value="none" label={t`No clock`} disabled />
 * </RadioGroup>
 * ```
 */
export function RadioGroup(props: RadioGroupProps): JSX.Element {
  const field = useFormField();
  return (
    <SdkRadioGroup
      class={spaced([
        'box gap-ui-xs',
        props.orientation === 'horizontal' ? 'flex-row flex-wrap' : undefined,
      ])}
      id={props.id ?? field?.id}
      data-testid={props.testId}
      data-component={componentId('RadioGroup')}
      value={props.value ?? null}
      onValueChange={(value) => {
        if (value !== null) props.onValueChange(value);
      }}
      disabled={props.disabled === true}
      aria-label={props['aria-label']}
      aria-labelledby={
        props['aria-labelledby'] ??
        (props['aria-label'] === undefined ? field?.labelId : undefined)
      }
      aria-describedby={props['aria-describedby'] ?? field?.describedBy}
      aria-invalid={
        props['aria-invalid'] === true || field?.invalid === true
          ? 'true'
          : undefined
      }
      aria-required={field?.required === true ? 'true' : undefined}
      aria-disabled={props.disabled === true ? 'true' : undefined}
      aria-orientation={props.orientation ?? 'vertical'}
    >
      {props.children}
    </SdkRadioGroup>
  );
}

/** Checked is the soft tint with a `primary-strong` edge and dot: the dot,
 * not only the color, marks it. */
function RadioMark(props: { checked: boolean }): JSX.Element {
  return (
    <span
      class={spaced([
        'box size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors motion-reduce:transition-none',
        props.checked
          ? 'border-primary-strong bg-tint-subtle'
          : 'border-outline bg-background',
      ])}
      aria-hidden="true"
    >
      <Show when={props.checked}>
        <span class="box size-2 rounded-full bg-primary-strong" />
      </Show>
    </span>
  );
}

export function Radio(props: RadioProps): JSX.Element {
  const id = `radio-${createUniqueId()}`;
  return (
    <div
      class="box has-disabled:opacity-disabled"
      data-component={componentId('Radio')}
    >
      <SdkRadio
        value={props.value}
        render={(part, state) => (
          <button
            {...part}
            disabled={state.disabled}
            {...(state.disabled ? { tabindex: -1 } : {})}
          />
        )}
        class={spaced([
          'clickable clickableTint flex-row items-center gap-ui-sm rounded-control px-ui-xs min-h-ui-control-md text-start',
          'disabled:cursor-default',
        ])}
        data-testid={props.testId}
        aria-describedby={
          props.description === undefined ? undefined : `${id}-description`
        }
        disabled={props.disabled === true}
      >
        {(state) => (
          <>
            <RadioMark checked={state.checked} />
            <span class="text textBody text-text">{props.label}</span>
          </>
        )}
      </SdkRadio>
      <Show when={props.description} keyed>
        {(description) => (
          // Under the label: past the mark (20), the gap (8) and the inset (4).
          <span class="text textCaption ps-ui-2xl" id={`${id}-description`}>
            {description}
          </span>
        )}
      </Show>
    </div>
  );
}
