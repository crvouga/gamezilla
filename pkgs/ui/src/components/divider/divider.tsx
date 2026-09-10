/** @jsxImportSource solid-js */
/** `Divider` -- 1px separator line, horizontal or vertical. */

import { type JSX, splitProps } from 'solid-js';
import { Box, type BoxProps, joinClass } from '../box';

export type DividerProps = BoxProps & {
  /** Orientation. Defaults to `"horizontal"`. */
  orientation?: 'horizontal' | 'vertical' | undefined;
};

export function Divider(props: DividerProps): JSX.Element {
  const [local, rest] = splitProps(props, ['orientation', 'class', 'dataSet']);
  const horizontal = (local.orientation ?? 'horizontal') === 'horizontal';
  return (
    <Box
      role="separator"
      aria-orientation={local.orientation ?? 'horizontal'}
      class={joinClass(
        'border-border border-solid',
        horizontal ? 'w-full border-b' : 'h-full border-l',
        local.class
      )}
      dataSet={{ component: 'Divider', ...local.dataSet }}
      {...rest}
    />
  );
}
