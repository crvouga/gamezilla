import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { Spinner } from '../spinner/index';
import styles from './game-search-state.module.css';

/**
 * Waiting for a game to be found: the screen's centre while it lasts. A
 * pulse around the activity indicator, what is being looked for, how long
 * it has taken as a large running clock, and a line of reassurance. The way
 * out is the caller's (a dock, or `actions` under the panel).
 */
export function GameSearchState(props: {
  title: JSX.Element;
  description: JSX.Element;
  /** The elapsed time, already worded by the caller (`0:42`). */
  elapsed: JSX.Element;
  /** A quieter line under the description: what happens next. */
  hint?: JSX.Element | undefined;
  /** Its commands, when they are not in a dock of their own. */
  actions?: JSX.Element | undefined;
}): JSX.Element {
  return (
    <section
      class={`${styles['search']} rounded-card border border-border bg-surface`}
      {...dataAttrs({ component: 'GameSearchState' })}
    >
      <div class={styles['pulse']} aria-hidden="true">
        <span class={styles['ring']} />
        <span class={styles['ring']} />
        <Spinner size="lg" />
      </div>
      <h2 class="text textHeading">{props.title}</h2>
      <div class={`text textDisplayXl textNumeral ${styles['elapsed']}`}>
        {props.elapsed}
      </div>
      <div class="text textBody" role="status" aria-live="polite">
        {props.description}
      </div>
      <Show when={props.hint}>
        <div class={`text textCaption ${styles['hint']}`}>{props.hint}</div>
      </Show>
      {props.actions}
    </section>
  );
}
