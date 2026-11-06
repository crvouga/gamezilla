/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import styles from './editor-workbench.module.css';

export type EditorWorkbenchProps = {
  /** What is being built (a board), at the start edge when there is room. */
  canvas: JSX.Element;
  /** What shapes it (size, a palette, a selection's settings). */
  tools: JSX.Element;
  /**
   * Where there is no room beside the canvas: `tools-first` (default) puts
   * the tools over the canvas, for tools used on every press (a palette);
   * `canvas-first` puts them after it, for settings changed rarely.
   */
  narrowOrder?: 'tools-first' | 'canvas-first' | undefined;
  /**
   * What is said about the canvas (how to use the tools, what to correct):
   * under the tools beside the canvas when there is room, after the canvas
   * when there is not, so the canvas never waits behind it.
   */
  notes?: JSX.Element | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `EditorWorkbench` -- an editor's canvas with its tools beside it.
 *
 * Measured on its own width: where there is room (720px and up) the canvas
 * takes a board's measure at the start edge and the tools fill a column
 * beside it, top-aligned, so every control stays in view with what it
 * changes, and the notes follow the tools in that column. Narrower, the two
 * stack in `narrowOrder`, which is also their reading order at every size,
 * and the notes come last.
 */
export function EditorWorkbench(props: EditorWorkbenchProps): JSX.Element {
  return (
    <div
      class={styles['workbench']}
      {...dataAttrs({ component: 'EditorWorkbench', ...props.dataSet })}
    >
      {/* The narrow order is the reading order too; wide, each side takes
          its own column whatever comes first. */}
      <div class={styles['grid']}>
        <Show
          when={props.narrowOrder === 'canvas-first'}
          fallback={
            <>
              <div class={styles['tools']}>{props.tools}</div>
              <div class={styles['canvas']}>{props.canvas}</div>
            </>
          }
        >
          <div class={styles['canvas']}>{props.canvas}</div>
          <div class={styles['tools']}>{props.tools}</div>
        </Show>
        <Show when={props.notes}>
          <div class={styles['notes']}>{props.notes}</div>
        </Show>
      </div>
    </div>
  );
}
