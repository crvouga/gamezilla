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
  readonly focused?: boolean;
  readonly onActivate?: () => void;
}): ReactNode {
  const focused = props.focused === true;
  return (
    <Box
      sx={focused ? colFocusedSx : colSx}
      {...(props.onActivate !== undefined
        ? { onPointerDown: props.onActivate }
        : {})}
      {...(focused ? { dataSet: { debuggerColumnFocused: '1' } } : {})}
    >
      {props.children}
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

const colBaseSx = {
  flex: 1,
  flexBasis: 0,
  minWidth: 0,
  minHeight: 0,
  overflow: 'hidden',
  borderTopWidth: 'hairline',
  borderRightWidth: 'hairline',
  borderBottomWidth: 'hairline',
  borderLeftWidth: 'hairline',
} as const;

const colSx = {
  ...colBaseSx,
  borderColor: 'border',
} as const;

const colFocusedSx = {
  ...colBaseSx,
  borderColor: 'tint',
} as const;
