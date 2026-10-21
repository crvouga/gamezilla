import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { type JSX, Show } from 'solid-js';
import styles from './game-ui.module.css';

export type GameStatusTone = 'neutral' | 'active' | 'success' | 'warning';

/**
 * The one line that says where the game stands: whose turn, or how it ended.
 * One per game, directly under the board. A marker carries the tone, the
 * words carry the meaning.
 *
 * With `live`, the words are a polite status: a listener hears them when
 * they change. `note` and `trailing` are outside that region, so a ticking
 * countdown there never re-reads the line.
 */
export function GameStatus(props: {
  title: JSX.Element;
  /** One quiet clause after the headline: the reason, a rating change. */
  detail?: JSX.Element;
  /** Defaults to `neutral`. `active` is the person's own turn. */
  tone?: GameStatusTone;
  /** Under the words, and not announced: a countdown. */
  note?: JSX.Element;
  /** Far edge of the line: one game fact. */
  trailing?: JSX.Element;
  /** Announce the words when they change. */
  live?: boolean;
  /** `data-*` for the words, the element that carries the status role. */
  dataSet?: ComponentDataSet;
}): JSX.Element {
  return (
    <div
      class={styles['status']}
      data-tone={props.tone ?? 'neutral'}
      {...dataAttrs({ component: 'GameStatus' })}
    >
      <span class={styles['statusMark']} aria-hidden="true" />
      <div class="box min-w-0 flex-1 gap-1">
        <div
          class="box min-w-0 gap-1"
          role={props.live === true ? 'status' : undefined}
          aria-live={props.live === true ? 'polite' : undefined}
          aria-atomic={props.live === true ? 'true' : undefined}
          {...dataAttrs({ component: 'GameStatusWords', ...props.dataSet })}
        >
          <div class="text textLabel">{props.title}</div>
          <Show when={props.detail}>
            <div class="text textCaption">{props.detail}</div>
          </Show>
        </div>
        <Show when={props.note}>{props.note}</Show>
      </div>
      <Show when={props.trailing}>
        <div class={styles['playerTrailing']}>{props.trailing}</div>
      </Show>
    </div>
  );
}
