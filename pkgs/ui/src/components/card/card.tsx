/** @jsxImportSource solid-js */
/**
 * `Card` -- bordered surface with optional elevation lift. The background is
 * the elevation token (`--ui-elevation-N`), which equals `surface` at level 1
 * in light schemes and lifts progressively in dark schemes.
 */

import { type JSX, splitProps } from 'solid-js';
import type { ElevationLevel } from '../../theme';
import { Box, type BoxProps } from '../box';

export type CardProps = BoxProps & {
  /** Elevation 0-5. Defaults to 1. */
  elevation?: ElevationLevel | undefined;
};

export function Card(props: CardProps): JSX.Element {
  const [local, rest] = splitProps(props, ['elevation', 'sx', 'dataSet']);
  return (
    <Box
      sx={[
        local.sx,
        {
          borderRadius: 'lg',
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: 'border',
          elevation: local.elevation ?? 1,
        },
      ]}
      dataSet={{ component: 'Card', ...local.dataSet }}
      {...rest}
    />
  );
}
