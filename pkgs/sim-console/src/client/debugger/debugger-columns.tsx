import { Box } from '@pkgs/ui';
import { type JSX, createEffect, onCleanup } from 'solid-js';

/** Stable web `id` for {@link DebuggerColumns} — used for outside-pointer hit tests. */
export const DEBUGGER_CLIENT_PANELS_NATIVE_ID = 'sim-debugger-client-panels';

/** Side-by-side instance columns (clients). Rooms stay on instance tabs. */
export function DebuggerColumns(props: {
  readonly children: JSX.Element;
  /**
   * When set, pointer-down outside these columns invokes the callback
   * (e.g. clear focused client). No-ops for presses inside the columns,
   * including nested client modals / palettes.
   */
  readonly onOutsidePointerDown?: () => void;
}): JSX.Element {
  useOutsideClientPanelsPointerDown(() => props.onOutsidePointerDown?.());
  return (
    <Box id={DEBUGGER_CLIENT_PANELS_NATIVE_ID} sx={rowSx}>
      {props.children}
    </Box>
  );
}

export function DebuggerColumn(props: {
  readonly children: JSX.Element;
  readonly focused?: boolean;
  readonly onActivate?: () => void;
}): JSX.Element {
  return (
    <Box
      sx={props.focused ? colFocusedSx : colSx}
      {...(props.onActivate !== undefined
        ? { onPointerDown: props.onActivate }
        : {})}
      dataSet={{ debuggerColumnFocused: props.focused ? '1' : undefined }}
    >
      {props.children}
    </Box>
  );
}

function useOutsideClientPanelsPointerDown(onOutside?: () => void): void {
  createEffect(() => {
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
    onCleanup(() =>
      document.removeEventListener('pointerdown', onPointerDown, true)
    );
  });
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
