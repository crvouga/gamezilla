/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import styles from '../game-ui.module.css';

/** The outcome mark: a plain line, a good result, or something to act on. */
export type GameTurnPillTone = 'neutral' | 'success' | 'warning';

/** `yours`: the viewer is to move. `neutral`: anyone else, or nobody. */
export type GameTurnPillEmphasis = 'yours' | 'neutral';

export type GameTurnPillProps = {
  title: JSX.Element;
  /** One quiet clause after the headline: the reason, a rating change. */
  detail?: JSX.Element;
  /** Defaults to `neutral`. `yours` is the viewer's own turn. */
  emphasis?: GameTurnPillEmphasis | undefined;
  /** Defaults to `neutral`: no mark. */
  tone?: GameTurnPillTone | undefined;
  /** Under the words, and not announced: a countdown. */
  note?: JSX.Element;
  /** Far edge of the line, outside the pill: game facts. */
  trailing?: JSX.Element;
  /** Announce the words when they change. */
  live?: boolean;
  /** `data-*` for the words, the element that carries the status role. */
  dataSet?: ComponentDataSet;
};

function PillWords(props: GameTurnPillProps & { yours: boolean }): JSX.Element {
  return (
    <div
      class="box min-w-0"
      role={props.live === true ? 'status' : undefined}
      aria-live={props.live === true ? 'polite' : undefined}
      aria-atomic={props.live === true ? 'true' : undefined}
      {...dataAttrs({ component: 'GameTurnPillWords', ...props.dataSet })}
    >
      <div
        class="text textLabel"
        classList={{ 'text-on-primary-soft': props.yours }}
      >
        {props.title}
      </div>
      <Show when={props.detail}>
        <div
          class="text textCaption"
          classList={{ 'text-on-primary-soft': props.yours }}
        >
          {props.detail}
        </div>
      </Show>
    </div>
  );
}

/**
 * `GameTurnPill` -- the one line that says where the game stands: whose
 * turn, or how it ended. One per game, between the board and the person's
 * own strip. The words sit in a round pill: the soft tint (`tintSubtle` under
 * `onPrimarySoft`) when it is the viewer's turn (`emphasis="yours"`), the
 * sunken well otherwise. A small mark carries an outcome's tone; the words
 * carry the meaning.
 *
 * With `live`, the words are a polite status: a listener hears them when
 * they change. Text a listener needs but the eye already has from the seats
 * goes in a `VisuallyHidden` inside `title`. `note` and `trailing` are
 * outside that region, so a ticking countdown there never re-reads the line.
 *
 * @example
 * ```tsx
 * <GameTurnPill live emphasis="yours" title="Your turn." />
 * <GameTurnPill live tone="success" title="Erin wins." trailing={<Badge … />} />
 * ```
 */
export function GameTurnPill(props: GameTurnPillProps): JSX.Element {
  const yours = (): boolean => props.emphasis === 'yours';
  const tone = (): GameTurnPillTone => props.tone ?? 'neutral';
  return (
    <div
      class={`${styles['turn']} box flex-row flex-wrap items-center justify-between gap-2 min-w-0`}
      data-tone={tone()}
      data-emphasis={yours() ? 'yours' : 'neutral'}
      {...dataAttrs({ component: 'GameTurnPill' })}
    >
      <div
        class={`${styles['turnPill']} rounded-full`}
        classList={{ 'bg-tint-subtle': yours(), 'bg-surface-muted': !yours() }}
      >
        <Show when={tone() !== 'neutral'}>
          <span class={styles['turnMark']} aria-hidden="true" />
        </Show>
        <div class="box min-w-0 gap-1">
          <PillWords {...props} yours={yours()} />
          <Show when={props.note}>{props.note}</Show>
        </div>
      </div>
      <Show when={props.trailing}>
        <div class={styles['playerTrailing']}>{props.trailing}</div>
      </Show>
    </div>
  );
}
