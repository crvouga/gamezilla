/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX, Show } from 'solid-js';
import { type GameSeatLook, GameSeatSwatch } from '../game-seat-swatch/index';
import { XIcon } from '../icons';
import { createScreenSlot } from '../screen-slot';
import styles from './game-stage-overlay.module.css';

/** The avatar size of a side on the versus card. */
export const GAME_VERSUS_AVATAR_SIZE = 56;

/** One side of the versus card: who plays, and as what. */
export type GameVersusSide = {
  id: string;
  name: JSX.Element;
  avatar: JSX.Element;
  /** The seat's look, before the name. */
  swatch?: GameSeatLook | undefined;
  /** One quiet line under the name: the side's name, a rating. */
  caption?: JSX.Element | undefined;
};

function VersusBand(props: {
  edge: 'top' | 'bottom';
  sides: readonly GameVersusSide[];
}): JSX.Element {
  return (
    <span
      class={styles['band']}
      data-edge={props.edge}
      data-solo={props.sides.length === 1}
    >
      <For each={props.sides}>
        {(side) => (
          <span class={styles['side']}>
            <span class={styles['sideAvatar']} aria-hidden="true">
              {side.avatar}
            </span>
            <span class={`text textHeading ${styles['sideName']}`}>
              <Show when={side.swatch}>
                {(look) => <GameSeatSwatch look={look()} />}
              </Show>
              <span>{side.name}</span>
            </span>
            <Show when={side.caption}>
              <span class={`text textCaption ${styles['sideCaption']}`}>
                {side.caption}
              </span>
            </Show>
          </span>
        )}
      </For>
    </span>
  );
}

export type GameVersusOverlayProps = {
  /** The other players, in the band above. */
  others: readonly GameVersusSide[];
  /** The person's own side (or the rest of a watched table), below. */
  own: readonly GameVersusSide[];
  /** The mark between them, in the person's language (`VS`). */
  mark: JSX.Element;
  /** Seconds until the board is theirs. */
  count: number;
  /** Before the count (`Starts in`). */
  countLabel: JSX.Element;
  /** What is being played, in one line: the game, its clock, rated or not. */
  mode?: JSX.Element | undefined;
  /** The one control, at the foot: straight to the board (`Skip`). */
  skipLabel: JSX.Element;
  /** The card's accessible name: who plays whom. */
  'aria-label': string;
  onSkip: () => void;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `GameVersusOverlay` -- who plays whom, over the board, in the seconds
 * before a game this device watched begin: the other players in a band
 * above, the person's own side in the accent band below, the mark between
 * them and a count down to the board. It covers the whole stage, the seats
 * included, so nobody is named twice. Its one control is a real button
 * (`skipLabel`) that goes straight to the board; a press anywhere on the
 * card does the same. It only shows a count it is given; the stage's
 * overlay machine owns the time. Motion is entrance only and is dropped
 * under reduced motion.
 *
 * @example
 * ```tsx
 * <GameBoardStage overlay={
 *   <GameVersusOverlay
 *     others={[{ id: 'yellow', name: 'jordan', avatar: <Avatar size={56} /> }]}
 *     own={[{ id: 'red', name: 'avery', avatar: <Avatar size={56} /> }]}
 *     mark="VS" count={3} countLabel="Starts in" skipLabel="Skip"
 *     aria-label="avery versus jordan" onSkip={skip}
 *   />
 * }>{board}</GameBoardStage>
 * ```
 */
export function GameVersusOverlay(props: GameVersusOverlayProps): JSX.Element {
  return (
    <div
      role="group"
      class={styles['versus']}
      aria-label={props['aria-label']}
      {...dataAttrs({ component: 'GameVersusOverlay', ...props.dataSet })}
    >
      <VersusBand edge="top" sides={props.others} />
      <VersusBand edge="bottom" sides={props.own} />
      <Show when={props.mode}>
        <span class={`text textCaption ${styles['line']}`}>{props.mode}</span>
      </Show>
      <span class={styles['centre']}>
        <span class={styles['mark']}>{props.mark}</span>
        <span class={styles['count']} aria-live="off">
          <span class="text textCaption">{props.countLabel}</span>
          <span class="text textStat textNumeral" data-versus-count>
            {props.count}
          </span>
        </span>
      </span>
      {/* One button over the whole card, drawn as the pill at its foot:
          a press anywhere on the card is the way to the board. */}
      <button
        type="button"
        class={styles['skipArea']}
        onClick={() => props.onSkip()}
        data-versus-skip
      >
        <span class={`text textLabel ${styles['skip']}`}>
          {props.skipLabel}
        </span>
      </button>
    </div>
  );
}

export type GameResultOverlayProps = {
  /** How the game went for this person; `neutral` for someone watching. */
  tone: 'won' | 'lost' | 'drawn' | 'neutral';
  /** Over the headline, in capitals: `Victory`, `Defeat`, `Draw`. */
  eyebrow?: JSX.Element | undefined;
  /** The result in a sentence (`You won`). */
  title: JSX.Element;
  /** Why (`Four in a row`), under it. */
  caption?: JSX.Element | undefined;
  /** The standings, a rating change. */
  children?: JSX.Element | undefined;
  /** The card's own commands; the first is the way back to the board. */
  actions?: JSX.Element | undefined;
  /**
   * The headline and its caption are the screen's live announcement: a
   * listener hears them when the card appears and when they change.
   */
  live?: boolean | undefined;
  /** Names the close control (`Show the board`). */
  dismissLabel: string;
  onDismiss: () => void;
  /** The headline's `data-*` (its test id). */
  titleDataSet?: ComponentDataSet | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `GameResultOverlay` -- how the game ended, on a card over the final
 * board: a word for the result, the headline, why, the standings and what
 * to do next. It never moves the board. Its close control (the words
 * `dismissLabel`, beside the result's word) and a press on
 * the dimmed board behind it both dismiss it; what it said stays reachable
 * from the screen's own commands.
 *
 * @example
 * ```tsx
 * <GameResultOverlay tone="won" eyebrow="Victory" title="You won"
 *   caption="Four in a row" dismissLabel="Show the board" onDismiss={close}
 *   actions={<Button title="Rematch" variant="solid" onClick={rematch} />}>
 *   <GameStandings rows={rows} aria-label="Standings" />
 * </GameResultOverlay>
 * ```
 */
export function GameResultOverlay(props: GameResultOverlayProps): JSX.Element {
  const actions = createScreenSlot(() => props.actions);
  return (
    <div
      class={styles['result']}
      {...dataAttrs({ component: 'GameResultOverlay', ...props.dataSet })}
    >
      <button
        type="button"
        class={styles['scrim']}
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => props.onDismiss()}
      />
      <section class={styles['card']} data-tone={props.tone}>
        <div class={styles['cardHead']}>
          <div
            class={styles['cardTitle']}
            role={props.live === true ? 'status' : undefined}
            aria-live={props.live === true ? 'polite' : undefined}
            aria-atomic={props.live === true ? true : undefined}
          >
            <Show when={props.eyebrow}>
              <span class={`text textCaption ${styles['eyebrow']}`}>
                {props.eyebrow}
              </span>
            </Show>
            <h2
              class="text textTitle"
              {...dataAttrs({ ...props.titleDataSet })}
            >
              {props.title}
            </h2>
            <Show when={props.caption}>
              <p class="text textBody text-text-secondary">{props.caption}</p>
            </Show>
          </div>
          {/* Named in words, not only a cross: closing is how the final
              board is seen, so the card says so. */}
          <button
            type="button"
            class={`text textCaption ${styles['dismiss']}`}
            onClick={() => props.onDismiss()}
            data-testid="game-result-overlay-dismiss"
          >
            <span class={styles['dismissWords']}>{props.dismissLabel}</span>
            <XIcon size={16} color="textSecondary" />
          </button>
        </div>
        {props.children}
        <Show when={actions.present()}>
          <div class="box flex-row flex-wrap gap-2 min-w-0">
            {actions.content()}
          </div>
        </Show>
      </section>
    </div>
  );
}

/**
 * The frame of a stage overlay: fills the board it is over. `GameBoardStage`
 * places its `overlay` in one; nothing else needs it.
 */
export function GameStageOverlayFrame(props: {
  children: JSX.Element;
}): JSX.Element {
  return (
    <div
      class={styles['overlay']}
      {...dataAttrs({ component: 'GameStageOverlay' })}
    >
      {props.children}
    </div>
  );
}
