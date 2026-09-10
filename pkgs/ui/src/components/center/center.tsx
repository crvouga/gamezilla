/** @jsxImportSource solid-js */
/** `Center` -- a `Box` that centers its children on both axes. */

import { type JSX, splitProps } from 'solid-js';
import { dataAttrs } from '../../component-id';
import { type DivBoxProps, joinClass } from '../box';

export type CenterProps = DivBoxProps;

export function Center(props: CenterProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'dataSet']);
  return (
    <div
      class={joinClass('box items-center justify-center', local.class)}
      {...dataAttrs({ component: 'Center', ...local.dataSet })}
      {...rest}
    />
  );
}
