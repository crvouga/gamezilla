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
 * over a few lines at a reading measure, and the commands that lead on
 * from the rules. The column is the prose measure on every layout, so a
 * line never runs past a comfortable length. Presentational.
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
      width="prose"
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
            <li class={styles['section']} data-key={section.key}>
              <span class={styles['marker']} aria-hidden="true">
                {index() + 1}
              </span>
              <div class={styles['words']}>
                <h2 class="text textHeading">{section.title}</h2>
                <div class="text textBody">{section.body}</div>
              </div>
            </li>
          )}
        </For>
      </ol>
      <Show when={actions.present()}>
        <div class={styles['actions']} data-layout="actions">
          {actions.content()}
        </div>
      </Show>
    </EmbeddedScreen>
  );
}
