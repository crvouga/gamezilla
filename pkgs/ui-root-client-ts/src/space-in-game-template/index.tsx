/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX, Show } from 'solid-js';
import { Button } from '../button/index';
import { SpacePeople } from '../space-person-sheet/space-people';
import { type SpaceScreenChrome, SpaceShell } from '../space-shell/index';
import type {
  SpaceGame,
  SpaceGameAction,
  SpaceGamePlay,
  SpacePerson,
  SpaceRole,
} from '../space-types';
import styles from './space-in-game-template.module.css';

/** The most actions the bar holds at once. */
export const SPACE_ACTION_BAR_MAX = 3;

export type SpaceInGameTemplateProps = SpaceScreenChrome & {
  /** The game being played: its `play` fills the stage. */
  game: SpaceGame & { play: SpaceGamePlay };
  role: SpaceRole;
  /** Everyone in the space; the game gives each a color, turn and data. */
  people: readonly SpacePerson[];
  dataSet?: ComponentDataSet | undefined;
};

function ActionButton(props: { action: SpaceGameAction }): JSX.Element {
  const primary = () => props.action.emphasis === 'primary';
  const destructive = () => props.action.tone === 'destructive';
  return (
    <Button
      title={props.action.label}
      intent={primary() ? 'primary' : destructive() ? 'danger' : 'neutral'}
      variant={primary() ? 'solid' : 'outline'}
      size="lg"
      fullWidth
      disabled={props.action.disabled}
      onClick={() => props.action.onPress()}
      dataSet={{ action: props.action.id }}
    />
  );
}

/**
 * `SpaceActionBar` -- the bottom of an in-game stage, by the thumbs: one to
 * three actions for this exact moment (at most one primary, destructive
 * ones in the destructive tone), or one line saying what the viewer is
 * waiting for. Always present at one height, so the board never resizes.
 */
export function SpaceActionBar(props: {
  actions: readonly SpaceGameAction[];
  waiting?: string | undefined;
}): JSX.Element {
  const { t } = useLingui();
  const shown = () => props.actions.slice(0, SPACE_ACTION_BAR_MAX);
  return (
    <div
      class={styles['bar']}
      role="group"
      aria-label={t`Game actions`}
      {...dataAttrs({ component: 'SpaceActionBar' })}
    >
      <Show
        when={shown().length > 0}
        fallback={
          <p class={`text textCaption ${styles['waiting']}`} role="status">
            {props.waiting ?? t`Waiting for the game`}
          </p>
        }
      >
        <For each={shown()}>{(action) => <ActionButton action={action} />}</For>
      </Show>
    </div>
  );
}

/**
 * `SpaceInGameTemplate` -- a space while a game is played, with the game
 * as a parameter. The game supplies everything in `SpaceGame.play`: the
 * slim status line, the whole board, the action bar's actions for this
 * moment (or what the viewer waits for), each person's color, turn and
 * one number, and the actions it adds to each person's sheet. The template
 * supplies the frame: the three rows, the board edge to edge in the stage,
 * the fixed action bar, and the people row with player-color rings and the
 * turn badge. Invite is hidden while a game runs.
 */
export function SpaceInGameTemplate(
  props: SpaceInGameTemplateProps
): JSX.Element {
  const play = () => props.game.play;
  return (
    <SpaceShell
      spaceName={props.spaceName}
      role={props.role}
      onBack={props.onBack}
      onSettings={props.onSettings}
      onLeave={props.onLeave}
      onEnd={props.onEnd}
      stage="fixed"
      dataSet={{
        component: 'SpaceInGameTemplate',
        game: props.game.key,
        ...props.dataSet,
      }}
      people={
        <SpacePeople
          people={props.people}
          viewer={props.role}
          phase="inGame"
          seat={play().seat}
          gameActions={play().personActions}
          onPersonAction={props.onPersonAction}
        />
      }
    >
      <div class={styles['stage']}>
        <div class={styles['status']}>
          <h2
            class={`text textHeading ${styles['headline']}`}
            aria-live="polite"
          >
            {play().status}
          </h2>
          <Show when={play().detail}>
            {(detail) => (
              <span class={`text textCaption ${styles['detail']}`}>
                {detail()}
              </span>
            )}
          </Show>
        </div>
        <div class={styles['board']} data-space-board="true">
          {play().board}
        </div>
        <SpaceActionBar actions={play().actions} waiting={play().waiting} />
      </div>
    </SpaceShell>
  );
}
