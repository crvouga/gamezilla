/** @jsxImportSource solid-js */
/**
 * `PickerSection` -- labeled vertical block for inline editor pickers.
 *
 * Groups a control (swatch grid, stepper, {@link Picker}, …) under a quiet
 * label with an optional description line.
 */

import { type JSX, Show } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Text } from '../text';

export type PickerSectionProps = {
  label: JSX.Element;
  children: JSX.Element;
  description?: JSX.Element | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function PickerSection(props: PickerSectionProps): JSX.Element {
  return (
    <Box
      as="section"
      sx={{ gap: 2, py: 1 }}
      dataSet={{ component: 'PickerSection', ...props.dataSet }}
    >
      <Text variant="label" label={props.label} />
      <Show
        when={props.description !== undefined && props.description !== null}
      >
        <Text
          variant="caption"
          sx={{ opacity: 0.75 }}
          label={props.description}
        />
      </Show>
      {props.children}
    </Box>
  );
}
