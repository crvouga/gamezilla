import {
  SpaceScreenNotice,
  useSpaceScreenChrome,
} from '@libs/spaces-client-ts/space-screen-chrome';
import { ClaimSpaceShell } from '@libs/spaces-client-ts/space-shell-claim';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { SpaceSetupTemplate } from '@pkgs/ui-root-client-ts/space-setup-template';
import type { SpaceGame } from '@pkgs/ui-root-client-ts/space-types';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { createMemo, For, type JSX, Match, Show, Switch } from 'solid-js';
import { useFrameSettings } from './game-frame-options';
import { FramePersonName } from './game-frame-people';
import type { FramePlaceProps } from './game-frame-screen-view';
import {
  type FrameSetupHandlers,
  frameSetupGameActions,
  frameSetupLiveActions,
  frameSetupPersonAction,
} from './game-frame-setup-actions';
import { frameStartNote } from './game-frame-setup-copy';
import {
  frameOwnInvitation,
  frameSeatData,
  frameSeatPeople,
  frameWatchers,
} from './game-frame-setup-people';
import { FrameNoticesView } from './game-frame-shell';
import { FrameClockWords, FrameStatusView } from './game-frame-status-view';
import type { FrameSetup } from './game-frame-view-types';

type Props = FramePlaceProps;

/** The viewer's own invitation, said where they land; answered under the command. */
function OwnInvitationNotice(props: Props): JSX.Element {
  return (
    <For each={props.setup?.seats.filter((seat) => seat.invitation?.mine)}>
      {(seat) => (
        <Show when={seat.invitation}>
          {(invitation) => (
            <StackVertical paddingX="lg" paddingTop="sm">
              <Notice tone="info">
                <P role="status" testId={`custom-game-${seat.side}-invitation`}>
                  <FramePersonName
                    person={invitation().inviter}
                    plainName={invitation().inviterName}
                    people={props.people}
                    bold
                  />{' '}
                  <Trans>invites you to play {seat.sideLabel}.</Trans>
                </P>
              </Notice>
            </StackVertical>
          )}
        </Show>
      )}
    </For>
  );
}

/**
 * Under row 1: the space's own notice, the connection and a refused
 * choice, the viewer's invitation, and the game's line for a listener.
 */
function SetupNotice(props: Props): JSX.Element {
  return (
    <>
      <SpaceScreenNotice />
      <Show when={props.connection !== 'online' || props.error !== ''}>
        <StackVertical paddingX="lg" paddingTop="sm" gap="sm">
          <FrameNoticesView
            connection={props.connection}
            error={props.error}
            beforeGame={props.phase === 'none'}
          />
        </StackVertical>
      </Show>
      <OwnInvitationNotice {...props} />
      <FrameStatusView status={props.status} spokenOnly />
    </>
  );
}

/** Where the person's private setup stands, and what getting ready still needs. */
function PrivateSetupStatus(props: {
  readonly complete: boolean;
  readonly ready: boolean;
}): JSX.Element {
  return (
    <>
      <P
        variant="bodyBold"
        role="status"
        dataSet={{ testid: 'custom-game-setup-status' }}
      >
        <Show
          when={props.complete}
          fallback={<Trans>Your private setup is incomplete.</Trans>}
        >
          <Trans>Your private setup is complete.</Trans>
        </Show>
      </P>
      <P variant="caption" tone="secondary" testId="custom-game-setup-hint">
        <Switch
          fallback={
            <Trans>
              Place every piece on the board, or take a random setup. Then you
              can get ready.
            </Trans>
          }
        >
          <Match when={props.ready}>
            <Trans>It is locked while you are ready.</Trans>
          </Match>
          <Match when={props.complete}>
            <Trans>You can still move pieces until you are ready.</Trans>
          </Match>
        </Switch>
      </P>
    </>
  );
}

/**
 * The stage over the game's card: that a custom game is unrated and its
 * clock, then the viewer's own private setup on the game's setup board
 * (only they see it), locked while they are ready or offline.
 */
function SetupBoard(props: Props): JSX.Element {
  const ready = (): boolean => props.setup?.start.readiness?.ready === true;
  return (
    <StackVertical gap="md">
      <Text variant="caption" tone="secondary">
        <Trans>Custom game</Trans>
        {' · '}
        <Text variant="inherit" testId="custom-game-unrated">
          <Trans>Unrated</Trans>
        </Text>
        <Show when={props.status}>
          {(status) => (
            <>
              {' · '}
              <FrameClockWords
                minutes={status().minutes}
                increment={status().increment}
              />
            </>
          )}
        </Show>
      </Text>
      <Show when={props.setup?.privateSetup}>
        {(own) => (
          <StackVertical gap="sm">
            <PrivateSetupStatus complete={own().complete} ready={ready()} />
            {props.setupBoard}
            <GameActionButton
              title={<Trans>Random setup</Trans>}
              size="lg"
              dataSet={{ testid: 'custom-game-setup-random' }}
              disabled={own().locked}
              operation={() => props.onRandomSetup()}
            />
          </StackVertical>
        )}
      </Show>
    </StackVertical>
  );
}

/** The line under a guest's ready toggle: where they stand, and who starts. */
function readyNote(setup: FrameSetup | null): string {
  if (setup === null) return t`Waiting for the creator to create a game.`;
  const invited = setup.seats.find(frameOwnInvitation);
  const start = frameStartNote(setup.start, invited?.sideLabel);
  if (invited !== undefined) return start;
  if (setup.start.readiness === null)
    return setup.viewerNotice ?? frameStartNote(setup.start);
  return setup.start.hostStarts
    ? `${start} ${t`Waiting for the host to start.`}`
    : start;
}

/** The line under the host's Start: why it waits, or that it can start. */
function startNote(props: Props, setup: FrameSetup | null): string | undefined {
  if (setup === null)
    return props.connection === 'needed'
      ? t`Starts when you are back online.`
      : undefined;
  return frameStartNote(setup.start);
}

/** Sends a choice; a refused one shows in the notice, so nothing is thrown here. */
function useHandlers(props: Props): FrameSetupHandlers {
  const chrome = useSpaceScreenChrome();
  const settle = (sent: Promise<void>): void => {
    sent.catch(() => undefined);
  };
  return {
    choose: (input) => settle(props.onChoose(input)),
    ready: () => settle(props.onReady()),
    playBot: () => settle(props.onPlayBot()),
    cancel: () => props.onConfirm('cancel'),
    space: (id, action) => chrome.onPersonAction(id, action),
  };
}

/**
 * The game as the setup template draws it: its settings rows, each seat's
 * data line, and each seat's own actions.
 */
function useSetupGame(props: Props, handlers: FrameSetupHandlers) {
  const chrome = useSpaceScreenChrome();
  const settings = useFrameSettings(
    () => props.setup?.options ?? null,
    props.onChoose
  );
  return createMemo(
    (): SpaceGame => ({
      ...props.game,
      tagline: props.goal ?? '',
      setup: {
        settings: settings(),
        personData: (person) => {
          const shown = props.setup;
          return shown === null ? undefined : frameSeatData(shown, person);
        },
        personActions: (person) =>
          frameSetupGameActions(
            props.setup,
            chrome.people,
            handlers.choose,
            person
          ),
      },
    })
  );
}

/**
 * A custom game before it starts, in the space's setup template: no game
 * yet (play the bots at once, or set one up with people), then the game
 * being set up. The people row holds each seat (pressing one opens what
 * the viewer may do with it: a bot, an open or closed seat, leaving it,
 * inviting someone, answering their own invitation) and everyone else
 * watching; the settings rows hold the player count, the game's own
 * options and the clock; the stage holds the viewer's private setup; and
 * at the foot, getting ready, Start, and the other live actions.
 */
export function FrameSetupPlace(props: Props): JSX.Element {
  const chrome = useSpaceScreenChrome();
  const handlers = useHandlers(props);
  const setup = (): FrameSetup | null => props.setup;
  const seated = createMemo(() => {
    const shown = setup();
    return shown === null ? [] : frameSeatPeople(shown, chrome.people);
  });
  const watchers = createMemo(() => frameWatchers(setup(), chrome.people));
  const game = useSetupGame(props, handlers);
  const readiness = () => setup()?.start.readiness ?? null;
  return (
    <>
      <ClaimSpaceShell />
      <SpaceSetupTemplate
        {...chrome}
        notice={<SetupNotice {...props} />}
        game={game()}
        people={seated()}
        watchers={watchers()}
        board={<SetupBoard {...props} />}
        onPersonAction={(id, action) =>
          frameSetupPersonAction(setup(), handlers, id, action)
        }
        onReadyChange={
          readiness() === null
            ? undefined
            : (ready) =>
                ready
                  ? handlers.ready()
                  : handlers.choose({ operation: 'unready' })
        }
        canReady={readiness()?.blocked !== true}
        onStart={
          setup()?.start.canStart === true
            ? () => handlers.choose({ operation: 'start' })
            : undefined
        }
        canStart={setup()?.start.reason === null}
        startNote={startNote(props, setup())}
        readyNote={readyNote(setup())}
        actions={frameSetupLiveActions(
          {
            setup: setup(),
            canCreate: props.canCreate,
            playerCount: props.playerCount,
            canCancel: props.play.canCancel,
          },
          handlers
        )}
        testIds={{
          ...chrome.testIds,
          start: 'custom-game-start',
          ready: 'custom-game-ready',
          note: 'custom-game-startable',
        }}
        dataSet={{
          testid: 'custom-game-content',
          phase: props.phase,
          place: props.place.screen,
        }}
      />
    </>
  );
}
