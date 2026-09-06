/** @jsxImportSource solid-js */
/**
 * Root layout for UI explorer component examples.
 *
 * Owns shared section spacing (`gap: 4`) and omits edge padding — ScreenBase /
 * ExplorerDetail already inset the body. Pass `sx` to override gap or add
 * layout extras (`minHeight`, `flex`, …).
 *
 * Examples never provide their own clock: the hosting app supplies
 * `ClockProvider` (wall at the process root, sim in tests).
 */

import type { JSX } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import type { SxInput } from '../../theme';
import { Box } from '../box';

export type ExampleRootProps = {
  children: JSX.Element;
  /** Merged over the default `{ gap: 4 }`. */
  sx?: SxInput | undefined;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function ExampleRoot(props: ExampleRootProps): JSX.Element {
  return (
    <Box
      sx={[{ gap: 4 }, props.sx]}
      dataSet={{ component: 'ExampleRoot', ...props.dataSet }}
    >
      {props.children}
    </Box>
  );
}
