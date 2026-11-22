/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX, Show } from 'solid-js';
import { Button } from '../button/index';
import { GameOptionField } from '../game-option-field/index';
import { GameTile } from '../game-tile/index';
import { spaceDataSet } from '../space-data-set';
import { SpacePeople } from '../space-person-sheet/space-people';
import {
  type SpaceScreenChrome,
  SpaceShell,
  type SpaceShellTestIds,
} from '../space-shell/index';
import type {
  SpaceGame,
  SpaceGameAction,
  SpacePerson,
  SpaceRole,
} from '../space-types';
import styles from './space-setup-template.module.css';

/**
 * Row 1's handles, and the setup's own: Start, the ready toggle, and the
 * note under them (`startNote` or `readyNote`).
 */
export type SpaceSetupTestIds = SpaceShellTestIds & {
  start?: string | undefined;
  ready?: string | undefined;
  note?: string | undefined;
};

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
  /**
   * A seated person says ready or not (`I'm ready` / `Not ready`): a
   * guest, and a host who holds a seat (status `ready` or `notReady`).
   */
  onReadyChange?: ((ready: boolean) => void) | undefined;
  /** Whether the viewer may say ready now (their private setup is done). */
  canReady?: boolean | undefined;
  /** The host starts the game; without it there is no Start. */
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
  /**
   * The game's other live actions, under the primary one for either role:
   * Accept and Decline an invitation, Take a seat, Cancel game.
   */
  actions?: readonly SpaceGameAction[] | undefined;
  testIds?: SpaceSetupTestIds | undefined;
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
        <div class={styles['settings']} data-read-only={readOnly()}>
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

/** The viewer's own status in the people row. */
function ownStatus(people: readonly SpacePerson[]) {
  return people.find((person) => person.you === true)?.status;
}

function GuestActions(props: SpaceSetupTemplateProps): JSX.Element {
  const { t } = useLingui();
  const watching = () =>
    (props.watchers ?? []).some((person) => person.you === true);
  return (
    <div class={styles['actions']}>
      <Show when={!watching() && props.onReadyChange !== undefined}>
        <ReadyButton {...props} />
      </Show>
      <p
        class={`text textCaption ${styles['muted']}`}
        {...dataAttrs(spaceDataSet({}, props.testIds?.note))}
      >
        {props.readyNote ??
          t`${props.hostName} can still switch to a different game.`}
      </p>
      <LiveActions actions={props.actions} />
    </div>
  );
}

function ReadyButton(props: SpaceSetupTemplateProps): JSX.Element {
  const { t } = useLingui();
  const ready = () => ownStatus(props.people) === 'ready';
  return (
    <Button
      title={ready() ? t`Not ready` : t`I'm ready`}
      variant={ready() ? 'outline' : 'solid'}
      intent={ready() ? 'neutral' : 'primary'}
      size="lg"
      fullWidth
      aria-pressed={ready()}
      disabled={!ready() && props.canReady === false}
      onClick={() => props.onReadyChange?.(!ready())}
      dataSet={spaceDataSet({ action: 'ready' }, props.testIds?.ready)}
    />
  );
}

/** A live action's button: the primary one filled, a destructive one quiet. */
function actionLook(action: SpaceGameAction): {
  readonly variant: 'solid' | 'outline' | 'ghost';
  readonly intent: 'primary' | 'neutral' | 'danger';
} {
  if (action.emphasis === 'primary')
    return { variant: 'solid', intent: 'primary' };
  if (action.tone === 'destructive')
    return { variant: 'ghost', intent: 'danger' };
  return { variant: 'outline', intent: 'neutral' };
}

/** The game's other live actions, each a button under the primary one. */
function LiveActions(props: {
  actions: readonly SpaceGameAction[] | undefined;
}): JSX.Element {
  return (
    <For each={props.actions ?? []}>
      {(action) => (
        <Button
          title={action.label}
          variant={actionLook(action).variant}
          intent={actionLook(action).intent}
          size="lg"
          fullWidth
          disabled={action.disabled === true}
          onClick={() => action.onPress()}
          dataSet={spaceDataSet({ action: action.id }, action.testId)}
        />
      )}
    </For>
  );
}

/**
 * The host's actions. A host who holds a seat says ready first: until
 * then their ready toggle is the one command; once ready, Start leads and
 * taking readiness back is the quiet command under it.
 */
function HostActions(props: SpaceSetupTemplateProps): JSX.Element {
  const { t } = useLingui();
  const seated = () => {
    const status = ownStatus(props.people);
    return (
      props.onReadyChange !== undefined &&
      (status === 'ready' || status === 'notReady')
    );
  };
  const waitsForOwnReady = () =>
    seated() && ownStatus(props.people) !== 'ready';
  return (
    <div class={styles['actions']}>
      <Show when={props.onStart !== undefined && !waitsForOwnReady()}>
        <Button
          title={t`Start ${props.game.name}`}
          size="lg"
          fullWidth
          disabled={props.canStart !== true}
          onClick={() => props.onStart?.()}
          dataSet={spaceDataSet({ action: 'start' }, props.testIds?.start)}
        />
      </Show>
      <Show when={seated()}>
        <ReadyButton {...props} />
      </Show>
      <Show when={props.startNote}>
        {(note) => (
          <p
            class={`text textCaption ${styles['muted']}`}
            {...dataAttrs(spaceDataSet({}, props.testIds?.note))}
          >
            {note()}
          </p>
        )}
      </Show>
      <LiveActions actions={props.actions} />
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
 *   (`GameOptionField`), and **Start** once `canStart`. A host who holds
 *   a seat says ready first, with the same toggle.
 *
 * Under the primary action, `actions` holds the game's other live
 * actions (accept an invitation, take a seat, cancel the game), and each
 * person's sheet opens with the game's `setup.personActions`.
 *
 * The people row shows the host "Setting up", seated guests "Not ready"
 * or "Ready" and `watchers` "Watching"; pressing anyone opens their
 * actions. A game with private setup (placing a fleet) fills `board`.
 */
export function SpaceSetupTemplate(
  props: SpaceSetupTemplateProps
): JSX.Element {
  const everyone = () => [
    ...props.people,
    ...(props.watchers ?? []).map(
      (person): SpacePerson => ({ ...person, status: 'watching' })
    ),
  ];
  return (
    <SpaceShell
      spaceName={props.spaceName}
      role={props.role}
      onBack={props.onBack}
      backLabel={props.backLabel}
      onSettings={props.onSettings}
      menu={props.menu}
      onLeave={props.onLeave}
      onEnd={props.onEnd}
      notice={props.notice}
      testIds={props.testIds}
      dataSet={{
        component: 'SpaceSetupTemplate',
        game: props.game.key,
        ...props.dataSet,
      }}
      people={
        <SpacePeople
          people={everyone()}
          viewer={props.role}
          phase="settingUp"
          data={props.game.setup.personData}
          gameActions={props.game.setup.personActions}
          capabilities={props.personCapabilities}
          onPersonAction={props.onPersonAction}
          onInvite={props.onInvite}
        />
      }
    >
      <SetupStage {...props} />
    </SpaceShell>
  );
}
