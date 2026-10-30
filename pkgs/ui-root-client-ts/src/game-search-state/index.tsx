import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import styles from '../game-ui.module.css';
import { Spinner } from '../spinner/index';

/**
 * Waiting for a game to be found: what is being looked for, how long it has
 * taken, and the way out. A panel like every other game section.
 */
export function GameSearchState(props: {
  title: JSX.Element;
  description: JSX.Element;
  /** The elapsed time, already worded by the caller ("12 seconds"). */
  elapsed: JSX.Element;
  actions: JSX.Element;
}): JSX.Element {
  return (
    <section
      class={`${styles['section']} rounded-card border border-border bg-surface`}
      {...dataAttrs({ component: 'GameSearchState' })}
    >
      <div class="box flex-row items-center gap-3">
        <Spinner />
        <div class="box min-w-0 flex-1 gap-1">
          <h2 class="text textNavigationTitle">{props.title}</h2>
          <div class="text textCaption" role="status" aria-live="polite">
            {props.description}
          </div>
        </div>
        <div class="text textCaption textNumeral" role="timer" aria-live="off">
          {props.elapsed}
        </div>
      </div>
      {props.actions}
    </section>
  );
}
