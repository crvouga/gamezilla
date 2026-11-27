import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
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
  /** Its commands, when they are not in a dock of their own. */
  actions?: JSX.Element | undefined;
  /**
   * In place of the spinner while the search cannot run (no connection):
   * a still mark, so nothing seems to be looking.
   */
  mark?: JSX.Element | undefined;
}): JSX.Element {
  return (
    <section
      class={`${styles['section']} rounded-card border border-border bg-surface`}
      {...dataAttrs({ component: 'GameSearchState' })}
    >
      <div class="box flex-row items-center gap-3">
        <Show when={props.mark} fallback={<Spinner color="default" />}>
          {props.mark}
        </Show>
        <div class="box min-w-0 flex-1 gap-1">
          <h2 class="text textNavigationTitle">{props.title}</h2>
          <div class="text textCaption" role="status" aria-live="polite">
            {props.description}
          </div>
          {/* Under the words, so a phone keeps them at the card's width. */}
          <div
            class="text textCaption textNumeral text-text-secondary"
            role="timer"
            aria-live="off"
          >
            {props.elapsed}
          </div>
        </div>
      </div>
      {props.actions}
    </section>
  );
}
