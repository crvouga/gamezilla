/** @jsxImportSource solid-js */
/** `Spacer` -- flex-grow filler that pushes siblings apart. */

import type { JSX } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';

export type SpacerProps = {
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function Spacer(props: SpacerProps): JSX.Element {
  return (
    <Box
      aria-hidden="true"
      sx={{ flex: 1 }}
      dataSet={{ component: 'Spacer', ...props.dataSet }}
    />
  );
}
