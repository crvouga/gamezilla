import { Box } from '@pkgs/ui';
import { type ReactNode, useEffect } from 'react';

/** Stable web `id` for {@link DebuggerColumns} — used for outside-pointer hit tests. */
export const DEBUGGER_CLIENT_PANELS_NATIVE_ID = 'sim-debugger-client-panels';

/** Side-by-side instance columns (clients). Rooms stay on instance tabs. */
export function DebuggerColumns(props: {
  readonly children: ReactNode;
  /**
   * When set, pointer-down outside these columns invokes the callback
   * (e.g. clear focused client). No-ops for presses inside the columns,
   * including nested client modals / palettes.
   */
  readonly onOutsidePointerDown?: () => void;
}): ReactNode {
  useOutsideClientPanelsPointerDown(props.onOutsidePointerDown);
  return (
    <Box
      nativeID={DEBUGGER_CLIENT_PANELS_NATIVE_ID}
      collapsable={false}
      sx={rowSx}
    >
      {props.children}
    </Box>
  );
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

function useOutsideClientPanelsPointerDown(onOutside?: () => void): void {
  useEffect(() => {
    if (onOutside === undefined) return;
    if (typeof document === 'undefined') return;
    const onPointerDown = (ev: PointerEvent) => {
      const root = document.getElementById(DEBUGGER_CLIENT_PANELS_NATIVE_ID);
      const target = ev.target;
      if (!(target instanceof Node)) {
        onOutside();
        return;
      }
      if (root !== null && root.contains(target)) return;
      onOutside();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [onOutside]);
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
