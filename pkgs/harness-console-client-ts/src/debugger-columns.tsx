import { Pane } from '@pkgs/ui-root-client-ts/pane';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { createEffect, type JSX, onCleanup } from 'solid-js';

/** Stable web `id` for {@link DebuggerColumns} — used for outside-pointer hit tests. */
export const DEBUGGER_CLIENT_PANELS_NATIVE_ID =
  'harness-debugger-client-panels';

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
    <StackHorizontal
      grow
      overflow="hidden"
      id={DEBUGGER_CLIENT_PANELS_NATIVE_ID}
    >
      {props.children}
    </StackHorizontal>
  );
}

export function DebuggerColumn(props: {
  readonly children: JSX.Element;
  readonly focused?: boolean;
  readonly onActivate?: () => void;
}): JSX.Element {
  return (
    <Pane
      border
      focused={props.focused === true}
      onActivate={() => props.onActivate?.()}
    >
      {props.children}
    </Pane>
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
