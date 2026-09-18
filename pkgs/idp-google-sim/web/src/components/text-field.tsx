/**
 * Outlined field with Google's floating label.
 *
 * The label is a sibling `span` driven by `:placeholder-shown`, not a real
 * `<label>`: Google labels its inputs with `aria-label`, and the headless
 * walkers read attributes, not accessible names.
 */

import 'solid-js';

/**
 * `attr:value` is dom-expressions' escape hatch back to `setAttribute`, which
 * is what this field needs: Solid would otherwise set `input.value` as a
 * property, and the rendered HTML would lose the address a human typed after a
 * failed step — the headless walkers and the no-JS view both read the markup,
 * not the live DOM.
 */
declare module 'solid-js' {
  namespace JSX {
    interface ExplicitAttributes {
      value: string;
    }
  }
}

export type TextFieldProps = {
  readonly testId: string;
  readonly name: string;
  readonly label: string;
  readonly type?: string | undefined;
  readonly value?: string | undefined;
  readonly autocomplete?: string | undefined;
  readonly inputmode?: 'email' | 'text' | undefined;
  readonly autofocus?: boolean | undefined;
  readonly invalid?: boolean | undefined;
  readonly describedBy?: string | undefined;
  readonly list?: string | undefined;
};

export function TextField(props: TextFieldProps) {
  const invalid = (): boolean => props.invalid === true;
  return (
    <div class="relative">
      <input
        class="peer h-14 w-full rounded border bg-white px-[15px] pt-[13px] pb-[13px] text-base text-gm-on-surface outline-none focus:border-2 focus:border-gm-primary focus:px-[14px] focus:pt-3 focus:pb-3"
        classList={{
          'border-gm-outline': !invalid(),
          'border-gm-error': invalid(),
        }}
        type={props.type ?? 'text'}
        name={props.name}
        placeholder=" "
        autofocus={props.autofocus === true}
        autocomplete={props.autocomplete}
        inputmode={props.inputmode}
        list={props.list}
        value={props.value ?? ''}
        aria-label={props.label}
        aria-invalid={invalid() ? 'true' : undefined}
        attr:value={props.value ?? ''}
        data-testid={props.testId}
      />
      <span class="pointer-events-none absolute top-1/2 left-[13px] -translate-y-1/2 rounded bg-white px-2 text-base text-gm-on-surface-variant transition-all duration-150 peer-focus:top-0 peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-xs motion-reduce:transition-none">
        {props.label}
      </span>
    </div>
  );
}
