/** @jsxImportSource solid-js */
/**
 * `Form` -- a native `<form>` laid out like a vertical stack. Enter in a
 * field and a `type="submit"` button both submit it; the browser's page load
 * is always prevented and `onSubmit` runs instead. Native constraint
 * validation (`required`, `maxLength`, `type="email"`) runs first unless
 * `noValidate` hands validation to the caller.
 *
 * Product code never writes `<form>`. An editor screen with Save / Cancel is
 * `FormScreen`, which owns its own form; `Form` is for a form inside a
 * screen, a sheet or a card.
 *
 * @example
 * ```tsx
 * <Form aria-label={t`Rename space`} onSubmit={save}>
 *   <FormField label={t`Name`} required>
 *     {(field) => <TextInput id={field.id} … />}
 *   </FormField>
 *   <Button type="submit" title={t`Save`} />
 * </Form>
 * ```
 */

import { componentId } from '@pkgs/ui-root-shared/component-id';
import type { SpaceToken } from '@pkgs/ui-root-shared/token-names';
import type { JSX } from 'solid-js';
import { spaced } from './layout-classes';
import type { Responsive } from './responsive';
import { spacingClass } from './space-classes';

export type FormProps = {
  /** Runs on submit, after the page load is prevented. */
  onSubmit: () => void;
  children?: JSX.Element | undefined;
  /** Space between the fields. Default `lg`. */
  gap?: Responsive<SpaceToken> | undefined;
  /** Skip the browser's constraint validation. */
  noValidate?: boolean | undefined;
  id?: string | undefined;
  'aria-label'?: string | undefined;
  'aria-labelledby'?: string | undefined;
  'aria-describedby'?: string | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
};

export function Form(props: FormProps): JSX.Element {
  return (
    <form
      class={spaced(['box', spacingClass({ gap: props.gap ?? 'lg' })])}
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('Form')}
      noValidate={props.noValidate === true}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      aria-describedby={props['aria-describedby']}
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      {props.children}
    </form>
  );
}
