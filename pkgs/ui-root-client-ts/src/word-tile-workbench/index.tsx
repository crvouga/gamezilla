import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import styles from './word-tile-workbench.module.css';

/** Word editing actions and full-width feedback, with clearance for session history. */
export function WordTileWorkbench(props: {
  children: JSX.Element;
}): JSX.Element {
  return (
    <div
      class={styles['workbench']}
      {...dataAttrs({ component: 'WordTileWorkbench' })}
    >
      {props.children}
    </div>
  );
}
