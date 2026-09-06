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
import type { SxAlign, SxInput, SxJustify, SxProps } from '../../theme';
import { Box, type BoxProps } from '../box';

export type StackDirection = 'horizontal' | 'vertical';

export type StackProps = BoxProps & {
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

export function stackLayoutSx(args: {
  direction: StackDirection;
  spacing: number | undefined;
  align: SxAlign | undefined;
  justify: SxJustify | undefined;
  wrap: boolean | undefined;
}): SxProps {
  const sx: SxProps = {
    flexDirection: args.direction === 'horizontal' ? 'row' : 'column',
  };
  if (args.spacing !== undefined) sx.gap = args.spacing;
  if (args.align) sx.alignItems = args.align;
  if (args.justify) sx.justifyContent = args.justify;
  if (args.wrap) sx.flexWrap = 'wrap';
  return sx;
}

export function Stack(props: StackProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'direction',
    'spacing',
    'align',
    'justify',
    'wrap',
    'sx',
    'dataSet',
  ]);
  const sx = (): SxInput => [
    stackLayoutSx({
      direction: local.direction ?? 'vertical',
      spacing: local.spacing,
      align: local.align,
      justify: local.justify,
      wrap: local.wrap,
    }),
    local.sx,
  ];
  return (
    <Box
      sx={sx()}
      dataSet={{ component: 'Stack', ...local.dataSet }}
      {...rest}
    />
  );
}
