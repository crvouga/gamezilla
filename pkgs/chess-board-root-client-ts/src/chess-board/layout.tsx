import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { type JSX, Show } from 'solid-js';
import styles from './layout.module.css';

/** Default match sizing stays intrinsic; square wells reserve guidance first. */
export function ChessBoardLayout(props: {
  readonly fitSquare?: boolean | undefined;
  readonly guidance: JSX.Element;
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <Show
      when={props.fitSquare}
      fallback={
        <StackVertical gap="xs">
          {props.guidance}
          {props.children}
        </StackVertical>
      }
    >
      <div class={styles['square']} data-component="ChessBoardLayout">
        <StackVertical gap="xs">{props.guidance}</StackVertical>
        <div class={styles['available']}>
          <div class={styles['fitted']}>{props.children}</div>
        </div>
      </div>
    </Show>
  );
}
