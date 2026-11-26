/** @jsxImportSource @solidjs/web */

import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { For, Show } from 'solid-js';
import { Button } from '../button/index';
import { GameOptionField } from '../game-option-field/index';
import { GameTile } from '../game-tile/index';
import { type SpaceScreenChrome, SpaceShell } from '../space-shell/index';
import type { SpaceGame, SpacePerson, SpaceRole } from '../space-types';
import styles from './space-setup-template.module.css';

export type SpaceSetupTemplateProps = SpaceScreenChrome & {
  /** The game being set up: a parameter, never a branch. */
  game: SpaceGame;
  /** The host sets the game up; a guest reads the settings and says ready. */
  role: SpaceRole;
  hostName: string;
  /** Everyone with a seat in the game, with their setup status. */
  people: readonly SpacePerson[];
  /**
   * People in the space without a seat: after the seated in the people
   * row, marked watching. A viewer among them gets no ready toggle.
   */
  watchers?: readonly SpacePerson[] | undefined;
  /**
   * The viewer's private setup, between the status and the game's
   * settings: placing a fleet. Only the viewer sees it.
   */
  board?: JSX.Element | undefined;
  /** A guest says ready or not (`I'm ready` / `Not ready`). */
  onReadyChange?: ((ready: boolean) => void) | undefined;
  /** The host starts the game. */
  onStart?: (() => void) | undefined;
  /** Whether the host may start now (everyone ready, seats filled). */
  canStart?: boolean | undefined;
  /** Under Start: why it waits, or who it starts with. */
  startNote?: string | undefined;
  /**
   * Under a guest's ready toggle (or in its place for a watcher); by
   * default, that the host can still switch games.
   */
  readyNote?: string | undefined;
  /** The host goes back to choosing a game. */
  onChangeGame?: (() => void) | undefined;
  dataSet?: ComponentDataSet | undefined;
};

function GameCard(props: { game: SpaceGame; role: SpaceRole }): JSX.Element {
  const { t } = useLingui();
  const readOnly = () => props.role === 'guest';
  return (
    <section class={styles['card']} aria-label={t`Game settings`}>
      <div class={styles['game']}>
        <GameTile motif={props.game.motif} size="lg" />
        <div class={styles['gameWords']}>
          <span class="text textHeading">{props.game.name}</span>
          <span class={`text textCaption ${styles['muted']}`}>
            {props.game.tagline}
          </span>
        </div>
      </div>
      <Show when={props.game.setup.settings.length > 0}>
        <div class={styles['settings']} data-read-only={String(readOnly())}>
          <For each={props.game.setup.settings}>
            {(field) => (
              <GameOptionField
                {...field}
                readOnly={readOnly() || field.readOnly === true}
              />
            )}
          </For>
        </div>
      </Show>
    </section>
  );
}

function GuestActions(props: SpaceSetupTemplateProps): JSX.Element {
  const { t } = useLingui();
  const ready = () =>
    props.people.find((person) => person.you === true)?.status === 'ready';
  const watching = () =>
    (props.watchers ?? []).some((person) => person.you === true);
  return (
    <div class={styles['actions']}>
      <Show when={!watching()}>
        <ReadyButton ready={ready()} onReadyChange={props.onReadyChange} />
      </Show>
      <p class={`text textCaption ${styles['muted']}`}>
        {props.readyNote ??
          t`${props.hostName} can still switch to a different game.`}
      </p>
    </div>
  );
}

function ReadyButton(props: {
  ready: boolean;
  onReadyChange: ((ready: boolean) => void) | undefined;
}): JSX.Element {
  const { t } = useLingui();
  const ready = () => props.ready;
  return (
    <Button
      title={ready() ? t`Not ready` : t`I'm ready`}
      variant={ready() ? 'outline' : 'solid'}
      intent={ready() ? 'neutral' : 'primary'}
      size="lg"
      fullWidth
      aria-pressed={ready()}
      onClick={() => props.onReadyChange?.(!ready())}
      dataSet={{ action: 'ready' }}
    />
  );
}

function HostActions(props: SpaceSetupTemplateProps): JSX.Element {
  const { t } = useLingui();
  return (
    <div class={styles['actions']}>
      <Button
        title={t`Start ${props.game.name}`}
        size="lg"
        fullWidth
        disabled={props.canStart !== true}
        onClick={() => props.onStart?.()}
        dataSet={{ action: 'start' }}
      />
      <Show when={props.startNote}>
        {(note) => (
          <p class={`text textCaption ${styles['muted']}`}>{note()}</p>
        )}
      </Show>
      <Show when={props.onChangeGame}>
        {(change) => (
          <Button
            title={t`Choose another game`}
            intent="neutral"
            variant="ghost"
            fullWidth
            onClick={() => change()()}
            dataSet={{ action: 'change-game' }}
          />
        )}
      </Show>
    </div>
  );
}

function SetupStage(props: SpaceSetupTemplateProps): JSX.Element {
  const { t } = useLingui();
  const host = () => props.role === 'host';
  return (
    <div
      class={styles['stage']}
      {...dataAttrs({ component: 'SpaceSetupStage' })}
    >
      <section class={styles['card']}>
        <h2 class="text textTitle">
          {host()
            ? t`Set up ${props.game.name}`
            : t`${props.hostName} is setting up ${props.game.name}`}
        </h2>
        <p class={`text textBody ${styles['muted']}`}>
          {host()
            ? t`Everyone sees these settings as you change them.`
            : t`The game starts when ${props.hostName} taps Start. Settings update here as ${props.hostName} changes them.`}
        </p>
      </section>
      <div class={styles['board']} data-space-setup-board="true">
        {props.board}
      </div>
      <GameCard game={props.game} role={props.role} />
      <Show when={host()} fallback={<GuestActions {...props} />}>
        <HostActions {...props} />
      </Show>
    </div>
  );
}

/**
 * `SpaceSetupTemplate` -- a space while the host sets up a game, with the
 * game as a parameter. Every game fills the same slots: its name, art and
 * one line (`SpaceGame`), its settings rows and each person's setup data
 * (`SpaceGame.setup`). The template supplies the three rows, the status
 * line and the one primary action.
 *
 * - `guest`: "bob is setting up Light Cycles", the settings read-only, and
 *   **I'm ready** (a toggle that turns into **Not ready**).
 * - `host`: "Set up Light Cycles", the game's own setup controls
 *   (`GameOptionField`), and **Start** once `canStart`.
 *
 * The people row shows the host "Setting up", seated guests "Not ready"
 * or "Ready" and `watchers` "Watching"; pressing anyone opens their
 * actions. A game with private setup (placing a fleet) fills `board`.
 */
export function SpaceSetupTemplate(
  props: SpaceSetupTemplateProps
): JSX.Element {
  return (
    <SpaceShell
      spaceName={props.spaceName}
      title={props.title ?? props.game.name}
      role={props.role}
      onBack={props.onBack}
      backLabel={props.backLabel}
      onMembers={props.onMembers}
      onRename={props.onRename}
      onMinimize={props.onMinimize}
      onInvite={props.onInvite}
      onLeave={props.onLeave}
      onEnd={props.onEnd}
      notice={props.notice}
      testIds={props.testIds}
      dataSet={{
        component: 'SpaceSetupTemplate',
        game: props.game.key,
        ...props.dataSet,
      }}
    >
      <SetupStage {...props} />
    </SpaceShell>
  );
}
