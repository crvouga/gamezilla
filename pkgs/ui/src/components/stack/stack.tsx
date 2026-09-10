/** @jsxImportSource solid-js */
/**
 * `Stack` -- flex container with direction and spacing.
 *
 * @example
 * ```tsx
 * <Stack direction="horizontal" spacing={2} align="center">
 *   <Avatar />
 *   <Text label="Username" />
 * </Stack>
 * ```
 */

import { type JSX, splitProps } from 'solid-js';
import { dataAttrs } from '../../component-id';
import { type DivBoxProps, joinClass } from '../box';
import type { SxAlign, SxJustify } from './layout-align';

export type { SxAlign, SxJustify } from './layout-align';

export type StackDirection = 'horizontal' | 'vertical';

export type StackProps = DivBoxProps & {
  /** Layout axis. Defaults to `"vertical"`. */
  direction?: StackDirection | undefined;
  /** Gap between children in spacing-scale units. */
  spacing?: number | undefined;
  /** Cross-axis alignment. */
  align?: SxAlign | undefined;
  /** Main-axis alignment. */
  justify?: SxJustify | undefined;
  /** Whether children should wrap. */
  wrap?: boolean | undefined;
};

const ALIGN_CLASS: Record<SxAlign, string> = {
  'flex-start': 'items-start',
  'flex-end': 'items-end',
  center: 'items-center',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
};

const JUSTIFY_CLASS: Record<SxJustify, string> = {
  'flex-start': 'justify-start',
  'flex-end': 'justify-end',
  center: 'justify-center',
  'space-between': 'justify-between',
  'space-around': 'justify-around',
  'space-evenly': 'justify-evenly',
};

export function stackLayoutClass(args: {
  direction: StackDirection;
  spacing: number | undefined;
  align: SxAlign | undefined;
  justify: SxJustify | undefined;
  wrap: boolean | undefined;
}): string {
  return joinClass(
    args.direction === 'horizontal' ? 'flex-row' : 'flex-col',
    args.spacing !== undefined ? `gap-${args.spacing}` : undefined,
    args.align !== undefined ? ALIGN_CLASS[args.align] : undefined,
    args.justify !== undefined ? JUSTIFY_CLASS[args.justify] : undefined,
    args.wrap ? 'flex-wrap' : undefined
  );
}

export function Stack(props: StackProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'direction',
    'spacing',
    'align',
    'justify',
    'wrap',
    'class',
    'dataSet',
    'children',
  ]);
  const layout = () =>
    stackLayoutClass({
      direction: local.direction ?? 'vertical',
      spacing: local.spacing,
      align: local.align,
      justify: local.justify,
      wrap: local.wrap,
    });
  return (
    <div
      class={joinClass('box', layout(), local.class)}
      {...dataAttrs({ component: 'Stack', ...local.dataSet })}
      {...rest}
    >
      {local.children}
    </div>
  );
}
