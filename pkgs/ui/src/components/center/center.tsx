/** @jsxImportSource solid-js */
/** `Center` -- a `Box` that centers its children on both axes. */

import { type JSX, splitProps } from 'solid-js';
import { Box, type BoxProps } from '../box';

export type CenterProps = BoxProps;

export function Center(props: CenterProps): JSX.Element {
  const [local, rest] = splitProps(props, ['sx', 'dataSet']);
  return (
    <Box
      sx={[{ alignItems: 'center', justifyContent: 'center' }, local.sx]}
      dataSet={{ component: 'Center', ...local.dataSet }}
      {...rest}
    />
  );
}
