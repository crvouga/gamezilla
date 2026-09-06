/** @jsxImportSource solid-js */
/**
 * `FadeSwitch` -- instant swap when `stateKey` changes (no animated fade; the
 * key is kept for API parity and as a `data-state-key` hook for E2E).
 */

import type { JSX } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';

export type FadeSwitchProps = {
  stateKey: string;
  children: JSX.Element;
  dataSet?: ComponentDataSet | undefined;
};

export function FadeSwitch(props: FadeSwitchProps): JSX.Element {
  return (
    <Box
      sx={{ flex: 1, minHeight: 0 }}
      dataSet={{
        component: 'FadeSwitch',
        'state-key': props.stateKey,
        ...props.dataSet,
      }}
    >
      {props.children}
    </Box>
  );
}
