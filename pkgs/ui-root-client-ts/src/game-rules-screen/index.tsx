/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX, Show } from 'solid-js';
import { EmbeddedScreen } from '../embedded-screen/index';
import {
  GameTile,
  type GameTileMotif,
  GameTitleLockup,
} from '../game-tile/index';
import { createScreenSlot } from '../screen-slot';
import styles from './game-rules-screen.module.css';

/** One part of how a game is played: a short name and a few lines. */
export type GameRulesSection = {
  key: string;
  title: JSX.Element;
  body: JSX.Element;
  /**
   * Entries read one by one rather than as a sentence (each piece's move,
   * each special move), listed under the body.
   */
  points?: readonly JSX.Element[] | undefined;
  /**
   * Pictures of the part in play (a move on a board), each with the words
   * that say what it shows: under the part's words on a phone, beside them
   * where the panel has room.
   */
  examples?: readonly GameRulesExample[] | undefined;
};

/** One picture of a rule in play, and what it shows in words. */
export type GameRulesExample = {
  key: string;
  figure: JSX.Element;
  caption: JSX.Element;
};

export type GameRulesScreenProps = {
  /** Stable screen identifier rendered as `data-screen`. */
  screenId: string;
  /** What the screen is, over the game's name (`How to play`). */
  eyebrow: JSX.Element;
  /** The game's name. */
  title: JSX.Element;
  /** The game's picture. */
  motif: GameTileMotif;
  /** One line under the name: what the game is. */
  subtitle?: JSX.Element | undefined;
  /** The rules, in the order they are learned, each numbered. */
  sections: readonly GameRulesSection[];
  /**
   * What to do once the rules are read (`Play`, `Back to the menu`), after
   * the last section behind a hairline, the main command first.
   */
  actions?: JSX.Element | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `GameRulesScreen` -- how a game is played, inside a space: the game's
 * picture and name under the screen's name, what it is, then its rules as
 * numbered parts (the goal, the turn, how it ends), each a short heading
 * (its number beside it) over a few lines at a reading measure, with
 * entries read one by one listed under them, and the commands that lead on
 * from the rules, held at the foot of the view while long rules scroll.
 * The rules start on the host's column, as the game's menu does, and stop
 * at a reading measure, so a line never runs past a comfortable length.
 * Presentational.
 *
 * @example
 * ```tsx
 * <GameRulesScreen
 *   screenId="game-how-to-play"
 *   eyebrow="How to play"
 *   title="Connect Four"
 *   motif="discs"
 *   sections={[{ key: 'goal', title: 'Goal', body: 'Line up four.' }]}
 *   actions={<Button title="Play" onClick={play} />}
 * />
 * ```
 */
export function GameRulesScreen(props: GameRulesScreenProps): JSX.Element {
  const subtitle = createScreenSlot(() => props.subtitle);
  const actions = createScreenSlot(() => props.actions);
  return (
    <EmbeddedScreen
      screenId={props.screenId}
      // The host's own column, so the rules start where the bar's trail
      // and the game's menu do; the reading measure caps them inside it.
      width="full"
      dataSet={{ component: 'GameRulesScreen', ...props.dataSet }}
    >
      <header class={styles['head']}>
        <p class="text textSectionLabel">{props.eyebrow}</p>
        <h1 class="text textTitle min-w-0 break-words">
          <GameTitleLockup tile={<GameTile motif={props.motif} size="lg" />}>
            {props.title}
          </GameTitleLockup>
        </h1>
        <Show when={subtitle.present()}>
          <p class={`${styles['tagline']} text textBody`}>
            {subtitle.content()}
          </p>
        </Show>
      </header>
      <ol class={styles['sections']}>
        <For each={props.sections}>
          {(section, index) => (
            <li
              class={styles['section']}
              data-key={section.key}
              data-pictured={section.examples?.length ? '' : undefined}
            >
              <div class={styles['words']}>
                <h2 class={`${styles['heading']} text textHeading`}>
                  <span class={styles['marker']} aria-hidden="true">
                    {index() + 1}
                  </span>
                  {section.title}
                </h2>
                <div class={`${styles['body']} text textBody`}>
                  {section.body}
                </div>
                <Show when={section.points?.length}>
                  <ul class={styles['points']}>
                    <For each={section.points}>
                      {(point) => (
                        <li class={`${styles['point']} text textBody`}>
                          {point}
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
              </div>
              <Show when={section.examples?.length}>
                <div class={styles['examples']}>
                  <For each={section.examples}>
                    {(example) => (
                      <figure class={styles['example']}>
                        <div class={styles['figure']}>{example.figure}</div>
                        <figcaption
                          class={`${styles['caption']} text textCaption`}
                        >
                          {example.caption}
                        </figcaption>
                      </figure>
                    )}
                  </For>
                </div>
              </Show>
            </li>
          )}
        </For>
      </ol>
      <Show when={actions.present()}>
        {/* Held at the foot of the view while long rules scroll, so the
            way on is always one press away. */}
        <div class={styles['actions']} data-layout="actions">
          {actions.content()}
        </div>
      </Show>
    </EmbeddedScreen>
  );
}
