/** @jsxImportSource solid-js */
/**
 * The divider between two windows: drag it, or focus it and use the arrows.
 * It is a WAI-ARIA window splitter, so its position is a value assistive
 * technology reads and sets.
 */

import { useLingui } from '@lingui/solid/macro';
import type { WindowSeparatorFrame } from '@pkgs/ui-devtools-shared-ts/window-layout-geometry';
import {
  WINDOW_SEPARATOR_KEYSHORTCUTS,
  windowSeparatorKeyCommand,
} from '@pkgs/ui-devtools-shared-ts/window-layout-keyboard';
import { componentId, dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createSignal, type JSX } from 'solid-js';
import styles from '../window-manager/window-manager.module.css';
import { useWindowManager } from '../window-manager-context';
import { captureWindowPointer } from '../window-manager-drag';
import { WINDOW_GAP } from '../window-manager-types';

export type WindowManagerSeparatorProps = {
  readonly frame: WindowSeparatorFrame;
};

type Grip = {
  readonly pointerId: number;
  readonly at: number;
  readonly value: number;
};

function separatorStyle(frame: WindowSeparatorFrame): JSX.CSSProperties {
  const half = WINDOW_GAP / 2;
  const { rect } = frame;
  return frame.direction === 'row'
    ? {
        left: `calc(${rect.left * 100}% - ${half}px)`,
        top: `calc(${rect.top * 100}% + ${half}px)`,
        width: `${WINDOW_GAP}px`,
        height: `calc(${rect.height * 100}% - ${WINDOW_GAP}px)`,
      }
    : {
        left: `calc(${rect.left * 100}% + ${half}px)`,
        top: `calc(${rect.top * 100}% - ${half}px)`,
        width: `calc(${rect.width * 100}% - ${WINDOW_GAP}px)`,
        height: `${WINDOW_GAP}px`,
      };
}

/** A divider of a `WindowManager`. Renders inside one. */
export function WindowManagerSeparator(
  props: WindowManagerSeparatorProps
): JSX.Element {
  const { t } = useLingui();
  const api = useWindowManager();
  const [grip, setGrip] = createSignal<Grip | null>(null);
  const row = (): boolean => props.frame.direction === 'row';
  const along = (event: PointerEvent): number =>
    row() ? event.clientX : event.clientY;
  const resize = (delta: number): void =>
    api.dispatch({
      type: 'resize',
      split: props.frame.split,
      index: props.frame.index,
      delta,
    });
  const onMove = (event: PointerEvent): void => {
    const held = grip();
    const box = api.bounds();
    if (held === null || event.pointerId !== held.pointerId) return;
    const size = (row() ? box?.width : box?.height) ?? 0;
    const extent = size * props.frame.extent;
    if (extent <= 0) return;
    const wanted = held.value + ((along(event) - held.at) / extent) * 100;
    const delta = (wanted - props.frame.value) / 100;
    if (delta !== 0) resize(delta);
  };
  return (
    <div
      class={`box absolute z-2 touch-none ${styles['separator'] ?? ''}`}
      classList={{
        'cursor-col-resize': row(),
        'cursor-row-resize': !row(),
      }}
      data-component={componentId('WindowManagerSeparator')}
      {...dataAttrs({
        'window-part': 'separator',
        'split-id': props.frame.split,
        'split-index': String(props.frame.index),
        active: String(grip() !== null),
      })}
      style={separatorStyle(props.frame)}
      role="separator"
      tabIndex={0}
      aria-label={
        row() ? t`Resize windows left and right` : t`Resize windows up and down`
      }
      aria-orientation={row() ? 'vertical' : 'horizontal'}
      aria-valuenow={props.frame.value}
      aria-valuemin={props.frame.min}
      aria-valuemax={props.frame.max}
      aria-keyshortcuts={WINDOW_SEPARATOR_KEYSHORTCUTS}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        captureWindowPointer(event.currentTarget, event.pointerId);
        setGrip({
          pointerId: event.pointerId,
          at: along(event),
          value: props.frame.value,
        });
      }}
      onPointerMove={onMove}
      onPointerUp={() => setGrip(null)}
      onPointerCancel={() => setGrip(null)}
      onDblClick={() =>
        api.dispatch({ type: 'equalize', split: props.frame.split })
      }
      onKeyDown={(event) => {
        const command = windowSeparatorKeyCommand(props.frame, event);
        if (command === null) return;
        event.preventDefault();
        api.dispatch(command);
      }}
    />
  );
}
