import { dataAttrs } from '@pkgs/ui';
import { createEffect, type JSX, onCleanup } from 'solid-js';

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
    <div class="box" style={rowSx} id={DEBUGGER_CLIENT_PANELS_NATIVE_ID}>
      {props.children}
    </div>
  );
}

export function DebuggerColumn(props: {
  readonly children: JSX.Element;
  readonly focused?: boolean;
  readonly onActivate?: () => void;
}): JSX.Element {
  return (
    <div
      class="box flex-1 min-w-[0] min-h-[0] overflow-hidden border border-solid"
      classList={{
        'border-border': props.focused !== true,
        'border-tint': props.focused === true,
      }}
      style={{ 'flex-basis': '0' }}
      {...dataAttrs({ debuggerColumnFocused: '1' })}
      {...(props.onActivate !== undefined
        ? { onPointerDown: props.onActivate }
        : {})}
    >
      {props.children}
    </div>
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
  'min-height': 0,
  'min-width': 0,
  'flex-direction': 'row',
  'align-items': 'stretch',
  overflow: 'hidden',
} as const;
