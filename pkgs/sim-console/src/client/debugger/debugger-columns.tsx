import { Box } from '@pkgs/ui';
import type { ReactNode } from 'react';

/** Side-by-side instance columns (clients). Rooms stay on instance tabs. */
export function DebuggerColumns(props: {
  readonly children: ReactNode;
}): ReactNode {
  return <Box sx={rowSx}>{props.children}</Box>;
}

export function DebuggerColumn(props: {
  readonly children: ReactNode;
}): ReactNode {
  return <Box sx={colSx}>{props.children}</Box>;
}

const rowSx = {
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  flexDirection: 'row',
  alignItems: 'stretch',
  overflow: 'hidden',
} as const;

const colSx = {
  flex: 1,
  flexBasis: 0,
  minWidth: 0,
  minHeight: 0,
  overflow: 'hidden',
  borderRightWidth: 1,
  borderColor: 'border',
} as const;
