import { Box, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { formatSimNodeLabel } from '../../shared/sim-node';

/** Side-by-side instance columns (clients). Rooms stay on instance tabs. */
export function DebuggerColumns(props: {
  readonly children: ReactNode;
}): ReactNode {
  return <Box sx={rowSx}>{props.children}</Box>;
}

export function DebuggerColumn(props: {
  readonly id: string;
  readonly kind: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <Box sx={colSx}>
      <Text sx={labelSx}>
        {formatSimNodeLabel({ id: props.id, kind: props.kind })}
      </Text>
      <Box sx={bodySx}>{props.children}</Box>
    </Box>
  );
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

const labelSx = {
  paddingHorizontal: 8,
  paddingVertical: 4,
  fontSize: 12,
  fontWeight: '600',
  color: 'textSecondary',
  borderBottomWidth: 1,
  borderColor: 'border',
  background: 'background',
} as const;

const bodySx = {
  flex: 1,
  minHeight: 0,
  minWidth: 0,
} as const;
