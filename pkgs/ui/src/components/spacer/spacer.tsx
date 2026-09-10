/** @jsxImportSource solid-js */
/** `Spacer` -- expands to fill remaining space in a flex row or column. */

import type { JSX } from 'solid-js';
import { type ComponentDataSet, dataAttrs } from '../../component-id';

export type SpacerProps = {
  dataSet?: ComponentDataSet | undefined;
};

export function Spacer(props: SpacerProps): JSX.Element {
  return (
    <div
      class="box flex-1"
      {...dataAttrs({ component: 'Spacer', ...props.dataSet })}
      aria-hidden="true"
    />
  );
}
