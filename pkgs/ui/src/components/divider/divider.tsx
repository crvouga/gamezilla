/** @jsxImportSource solid-js */
/** `Divider` -- 1px separator line, horizontal or vertical. */

import { type JSX, splitProps } from 'solid-js';
import type { SxProps } from '../../theme';
import { Box, type BoxProps } from '../box';

export type DividerProps = BoxProps & {
  /** Orientation. Defaults to `"horizontal"`. */
  orientation?: 'horizontal' | 'vertical' | undefined;
};

export function Divider(props: DividerProps): JSX.Element {
  const [local, rest] = splitProps(props, ['orientation', 'sx', 'dataSet']);
  const lineSx = (): SxProps =>
    (local.orientation ?? 'horizontal') === 'horizontal'
      ? { width: '100%', borderBottomWidth: 'hairline' }
      : { height: '100%', borderLeftWidth: 1 };
  return (
    <Box
      role="separator"
      aria-orientation={local.orientation ?? 'horizontal'}
      sx={[lineSx(), { borderColor: 'border', borderStyle: 'solid' }, local.sx]}
      dataSet={{ component: 'Divider', ...local.dataSet }}
      {...rest}
    />
  );
}
