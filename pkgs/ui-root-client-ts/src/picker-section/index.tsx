/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';

export type PickerSectionProps = {
  label: JSX.Element;
  children: JSX.Element;
  description?: JSX.Element | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `PickerSection` -- labeled vertical block for inline editor pickers.
 *
 * Groups a control (swatch grid, stepper, {@link Picker}, …) under a quiet
 * label with an optional description line.
 */
export function PickerSection(props: PickerSectionProps): JSX.Element {
  return (
    <section
      class="box gap-2 py-1"
      {...dataAttrs({ component: 'PickerSection', ...props.dataSet })}
    >
      <label class="text textLabel">{props.label}</label>
      <Show
        when={props.description !== undefined && props.description !== null}
      >
        <p class="text textCaption opacity-75">{props.description}</p>
      </Show>
      {props.children}
    </section>
  );
}
