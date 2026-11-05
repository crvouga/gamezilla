/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
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
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `EditorWorkbench` -- an editor's canvas with its tools beside it.
 *
 * Measured on its own width: where there is room (720px and up) the canvas
 * takes a board's measure at the start edge and the tools fill a column
 * beside it, top-aligned, so every control stays in view with what it
 * changes. Narrower, the two stack in `narrowOrder`.
 */
export function EditorWorkbench(props: EditorWorkbenchProps): JSX.Element {
  return (
    <div
      class={styles['workbench']}
      {...dataAttrs({ component: 'EditorWorkbench', ...props.dataSet })}
    >
      <div
        class={styles['grid']}
        data-order={props.narrowOrder ?? 'tools-first'}
      >
        <div class={styles['canvas']}>{props.canvas}</div>
        <div class={styles['tools']}>{props.tools}</div>
      </div>
    </div>
  );
}
