/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import {
  nextRovingIndex,
  rovingTabStop,
} from '@pkgs/ui-root-shared-ts/roving-focus';
import {
  type Accessor,
  createContext,
  createSignal,
  createUniqueId,
  type JSX,
  onCleanup,
  Show,
  useContext,
} from 'solid-js';
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

type RadioEntry = {
  readonly value: () => string;
  readonly disabled: () => boolean;
};

type RadioGroupApi = {
  readonly value: Accessor<string | undefined>;
  readonly disabled: Accessor<boolean>;
  readonly tabStop: Accessor<string | undefined>;
  readonly register: (entry: RadioEntry) => () => void;
  readonly select: (value: string) => void;
};

const RadioGroupContext = createContext<RadioGroupApi | null>(null);

function useRadioGroup(): RadioGroupApi {
  const api = useContext(RadioGroupContext);
  if (api === null) throw new Error('Radio: render inside a RadioGroup');
  return api;
}

function createRadioGroupApi(props: RadioGroupProps): RadioGroupApi {
  const [entries, setEntries] = createSignal<readonly RadioEntry[]>([]);
  const disabled = (): boolean => props.disabled === true;
  return {
    value: () => props.value,
    disabled,
    tabStop: () => {
      const list = entries();
      const flags = list.map((entry) => disabled() || entry.disabled());
      const selected = list.findIndex((entry) => entry.value() === props.value);
      const index = rovingTabStop(selected, flags);
      return index === null ? undefined : list[index]?.value();
    },
    register: (entry) => {
      setEntries((list) => [...list, entry]);
      return () => setEntries((list) => list.filter((e) => e !== entry));
    },
    select: (value) => {
      if (value !== props.value) props.onValueChange(value);
    },
  };
}

function onRadioKeyDown(radio: HTMLElement, event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    // A radio never submits or toggles on Enter.
    event.preventDefault();
    return;
  }
  const group = radio.closest('[role="radiogroup"]');
  if (group === null) return;
  const items = Array.from(
    group.querySelectorAll<HTMLButtonElement>('[role="radio"]')
  );
  const current = items.findIndex((item) => item === document.activeElement);
  const next = nextRovingIndex({
    key: event.key,
    current,
    disabled: items.map((item) => item.disabled),
    orientation: 'both',
    homeEnd: false,
  });
  if (next === null) return;
  event.preventDefault();
  const target = items[next];
  target?.focus();
  target?.click();
}

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
  const api = createRadioGroupApi(props);
  return (
    <div
      class={spaced([
        'box gap-ui-xs',
        props.orientation === 'horizontal' ? 'flex-row flex-wrap' : undefined,
      ])}
      id={props.id ?? field?.id}
      data-testid={props.testId}
      data-component={componentId('RadioGroup')}
      role="radiogroup"
      aria-label={props['aria-label']}
      aria-labelledby={
        props['aria-labelledby'] ??
        (props['aria-label'] === undefined ? field?.labelId : undefined)
      }
      aria-describedby={props['aria-describedby'] ?? field?.describedBy}
      aria-invalid={
        props['aria-invalid'] === true || field?.invalid === true
          ? true
          : undefined
      }
      aria-required={field?.required === true ? true : undefined}
      aria-disabled={props.disabled === true ? true : undefined}
      aria-orientation={props.orientation ?? 'vertical'}
    >
      <RadioGroupContext.Provider value={api}>
        {props.children}
      </RadioGroupContext.Provider>
    </div>
  );
}

/** Checked is the soft blue with a `primary-strong` edge and dot: the dot,
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
  const group = useRadioGroup();
  const id = `radio-${createUniqueId()}`;
  const disabled = (): boolean => group.disabled() || props.disabled === true;
  const checked = (): boolean => group.value() === props.value;
  onCleanup(
    group.register({ value: () => props.value, disabled: () => disabled() })
  );
  return (
    <div
      class={spaced(['box', disabled() ? 'opacity-disabled' : undefined])}
      data-component={componentId('Radio')}
    >
      <button
        type="button"
        class={spaced([
          'clickable clickableTint flex-row items-center gap-ui-sm rounded-control px-ui-xs min-h-ui-control-md text-start',
          disabled() ? 'cursor-default' : undefined,
        ])}
        data-testid={props.testId}
        role="radio"
        aria-checked={checked()}
        aria-describedby={
          props.description === undefined ? undefined : `${id}-description`
        }
        tabIndex={group.tabStop() === props.value ? 0 : -1}
        disabled={disabled()}
        onClick={() => group.select(props.value)}
        onKeyDown={(event) => onRadioKeyDown(event.currentTarget, event)}
      >
        <RadioMark checked={checked()} />
        <span class="text textBody text-text">{props.label}</span>
      </button>
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
