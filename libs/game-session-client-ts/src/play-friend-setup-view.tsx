import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { Badge, HostBadge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameModeCard } from '@pkgs/ui-root-client-ts/game-lobby';
import { GameSeatSwatch } from '@pkgs/ui-root-client-ts/game-seat-swatch';
import { GameActions } from '@pkgs/ui-root-client-ts/game-section';
import {
  ClockIcon,
  LockIcon,
  SlidersHorizontalIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import type { JSX } from '@solidjs/web';
import { For, Match, Show, Switch } from 'solid-js';
import {
  FrameHolderAvatar,
  FrameHolderName,
  FramePersonName,
} from './game-frame-people';
import { FrameLobbyPage } from './game-frame-shell';
import {
  type FrameFillSeat,
  FrameStartView,
} from './game-frame-start-line-view';
import { FrameClockWords } from './game-frame-status-view';
import type {
  FrameOptions,
  FrameSetup,
  FrameSetupSeat,
} from './game-frame-view-types';
import type { FramePlaceProps } from './game-session-screen-view';

type Props = FramePlaceProps;

const SEAT_AVATAR_SIZE = 32;

/**
 * Holders whose readiness the seat shows: a person, or a guest here. A bot
 * is always ready and never what the game waits for, so its seat says
 * nothing about it.
 */
function showsReadiness(seat: FrameSetupSeat): boolean {
  const kind = seat.holder.kind;
  return kind === 'person' || kind === 'local';
}

/**
 * Beside the holder's name: one tag for the host's own seat or the
 * viewer's seat at someone else's table.
 */
function SeatTags(props: { readonly seat: FrameSetupSeat }): JSX.Element {
  return (
    <>
      <Show when={props.seat.host}>
        <HostBadge
          size="sm"
          dataSet={{ testid: `game-session-${props.seat.side}-host` }}
        />
      </Show>
      <Show when={props.seat.visiting}>
        <Badge
          intent="info"
          size="sm"
          label={<Trans>You · guest</Trans>}
          dataSet={{ testid: `game-session-${props.seat.side}-you` }}
        />
      </Show>
    </>
  );
}

/** Under the holder's name: the side's look and name, then its clock. */
function SeatFacts(props: { readonly seat: FrameSetupSeat }): JSX.Element {
  return (
    <StackHorizontal gap="sm" align="center" wrap>
      <GameSeatSwatch look={props.seat.swatch} />
      <Text variant="caption">{props.seat.sideLabel}</Text>
      <Show when={props.seat.clock}>
        {(clock) => (
          <Text
            variant="caption"
            testId={`game-session-${props.seat.side}-clock`}
          >
            · {clock().value}
          </Text>
        )}
      </Show>
    </StackHorizontal>
  );
}

/**
 * Where the seat stands, at the row's end, as one tag every seat has in
 * the same place: ready or not for a person, else what holds the seat up
 * (an invitation not answered, an empty seat) or that a bot plays it.
 */
function SeatState(props: { readonly seat: FrameSetupSeat }): JSX.Element {
  const kind = () => props.seat.holder.kind;
  return (
    <Switch>
      <Match when={showsReadiness(props.seat) && props.seat.ready}>
        <Badge intent="success" tone="solid" label={<Trans>Ready</Trans>} />
      </Match>
      <Match when={showsReadiness(props.seat)}>
        <Badge intent="neutral" label={<Trans>Not ready</Trans>} />
      </Match>
      <Match when={kind() === 'invitation'}>
        <Badge
          intent="warning"
          label={<Trans>Invited</Trans>}
          dataSet={{ testid: `game-session-${props.seat.side}-invited` }}
        />
      </Match>
      <Match when={kind() === 'open'}>
        <Badge intent="brand" label={<Trans>Open</Trans>} />
      </Match>
      <Match when={kind() === 'bot'}>
        <Badge intent="neutral" label={<Trans>Bot</Trans>} />
      </Match>
    </Switch>
  );
}

/** Whether the seat's own place has anything for the viewer to do. */
export function seatOpens(seat: FrameSetupSeat): boolean {
  return (
    seat.choices !== null ||
    seat.canSit ||
    seat.canLeave ||
    seat.invitation?.canAnswer === true ||
    seat.invitation?.canRevoke === true
  );
}

/**
 * One seat as a row: who holds it, its side and readiness, its clock. A
 * seat the viewer may change opens its own place; any other only reads.
 */
function SeatRow(
  props: Props & { readonly seat: FrameSetupSeat }
): JSX.Element {
  const side = () => props.seat.side;
  return (
    <MenuRow
      leading={
        <FrameHolderAvatar
          holder={props.seat.holder}
          plainName={props.seat.plainName}
          size={SEAT_AVATAR_SIZE}
          setup
          people={props.people}
        />
      }
      title={
        <StackHorizontal gap="sm" align="center">
          <Text variant="inherit" testId={`game-session-${side()}-person`}>
            <FrameHolderName
              holder={props.seat.holder}
              plainName={props.seat.plainName}
              people={props.people}
            />
          </Text>
          {/* Its own centred row: a `Badge` starts itself at the top of a
              row, which would lift it above the name's centre line. */}
          <StackHorizontal gap="sm" align="center">
            <SeatTags seat={props.seat} />
          </StackHorizontal>
        </StackHorizontal>
      }
      caption={<SeatFacts seat={props.seat} />}
      value={<SeatState seat={props.seat} />}
      onClick={
        seatOpens(props.seat)
          ? () => props.onOpen({ screen: 'seat', side: side() })
          : undefined
      }
      dataSet={{
        testid: seatOpens(props.seat)
          ? `game-session-${side()}-choices`
          : `game-session-${side()}`,
      }}
    />
  );
}

/** An invitation the viewer holds, said where they land; answered in the dock. */
function OwnInvitation(
  props: Props & { readonly seat: FrameSetupSeat }
): JSX.Element {
  const side = () => props.seat.side;
  return (
    <Show when={props.seat.invitation?.mine ? props.seat.invitation : null}>
      {(invitation) => (
        <Notice tone="info">
          <StackVertical gap="md">
            <P role="status" testId={`game-session-${side()}-invitation`}>
              <FramePersonName
                person={invitation().inviter}
                plainName={invitation().inviterName}
                people={props.people}
                bold
              />{' '}
              <Trans>invites you to play {props.seat.sideLabel}.</Trans>
            </P>
          </StackVertical>
        </Notice>
      )}
    </Show>
  );
}

/**
 * Answering one's own invitation, in the dock where the lobby's one thing
 * to do always is: accept (the filled command) or decline.
 */
function InvitationAnswer(
  props: Props & { readonly setup: FrameSetup }
): JSX.Element {
  const seat = () =>
    props.setup.seats.find(
      (each) =>
        each.invitation?.mine === true && each.invitation.canAnswer === true
    );
  return (
    <Show when={seat()}>
      {(own) => (
        <GameActions sizing="fill">
          <GameActionButton
            title={<Trans>Accept</Trans>}
            variant="solid"
            size="lg"
            dataSet={{ testid: `game-session-${own().side}-accept` }}
            operation={() =>
              props.onChoose({ operation: 'accept', side: own().side })
            }
          />
          <GameActionButton
            title={<Trans>Decline</Trans>}
            size="lg"
            dataSet={{ testid: `game-session-${own().side}-decline` }}
            operation={() =>
              props.onChoose({ operation: 'decline', side: own().side })
            }
          />
        </GameActions>
      )}
    </Show>
  );
}

/** The game's own options in a few words (`Classic · 3`), as the row's value. */
function optionsSummary(options: FrameOptions): string {
  return options.groups
    .map((group) => {
      if (group.kind === 'count') return String(group.read(options.position));
      const value = group.read(options.position);
      return (
        group.options.find((choice) => choice.value === value)?.label() ?? value
      );
    })
    .join(' · ');
}

/** What is agreed about the game, each behind its own row. */
function AgreedRows(
  props: Props & { readonly setup: FrameSetup }
): JSX.Element {
  const options = () => props.setup.options;
  const rules = (): FrameOptions | null => {
    const shown = options();
    return shown !== null && (shown.groups.length > 0 || shown.players !== null)
      ? shown
      : null;
  };
  return (
    <Show
      when={
        rules() !== null ||
        options()?.clock != null ||
        props.setup.privateSetup !== null
      }
    >
      <MenuSection title={<Trans>Game</Trans>}>
        <Show when={rules()}>
          {(shown) => (
            <MenuRow
              leading={<SlidersHorizontalIcon size={20} />}
              title={<Trans>Options</Trans>}
              value={optionsSummary(shown())}
              onClick={() => props.onOpen({ screen: 'options' })}
              dataSet={{ testid: 'game-session-rules' }}
            />
          )}
        </Show>
        <Show when={options()?.clock}>
          {(clock) => (
            <MenuRow
              leading={<ClockIcon size={20} />}
              title={<Trans>Clock and sides</Trans>}
              value={
                <FrameClockWords
                  minutes={clock().minutes}
                  increment={clock().increment}
                />
              }
              onClick={() => props.onOpen({ screen: 'clock' })}
              dataSet={{ testid: 'game-session-options' }}
            />
          )}
        </Show>
        <Show when={props.setup.privateSetup}>
          {(own) => (
            <MenuRow
              leading={<LockIcon size={20} />}
              title={<Trans>Your private setup</Trans>}
              caption={<Trans>Only you see it</Trans>}
              // The row shows one word; a listener hears the whole sentence.
              value={
                <Text
                  variant="inherit"
                  role="status"
                  dataSet={{ testid: 'game-session-setup-status' }}
                >
                  <Show
                    when={own().complete}
                    fallback={
                      <Trans>
                        <VisuallyHidden>Your private setup is </VisuallyHidden>
                        incomplete<VisuallyHidden>.</VisuallyHidden>
                      </Trans>
                    }
                  >
                    <Trans>
                      <VisuallyHidden>Your private setup is </VisuallyHidden>
                      complete<VisuallyHidden>.</VisuallyHidden>
                    </Trans>
                  </Show>
                </Text>
              }
              onClick={() => props.onOpen({ screen: 'private-setup' })}
              dataSet={{ testid: 'game-session-setup-open' }}
            />
          )}
        </Show>
      </MenuSection>
    </Show>
  );
}

/** How many seats someone or something holds, of how many. */
function seatedCount(seats: readonly FrameSetupSeat[]): number {
  return seats.filter((seat) => {
    const kind = seat.holder.kind;
    return kind === 'person' || kind === 'bot' || kind === 'local';
  }).length;
}

/**
 * What is about to be played, at the head of the lobby: the game and how
 * it is won, and over them, in one line, that it is unrated and its clock
 * (when the clock has no row below). It pictures no board, so the seats
 * and what is agreed lead.
 */
function LobbyMode(props: Props & { readonly setup: FrameSetup }): JSX.Element {
  return (
    <GameModeCard
      // What is agreed is one compact line, not a panel: unrated, and the
      // clock when it has no row of its own below.
      eyebrow={
        <>
          {/* A dot stays with the fact before it, so a wrapped line
              never starts with one. */}
          <Trans>Play Friend</Trans>
          {'\u00a0· '}
          <Text variant="inherit" testId="game-session-unrated">
            <Trans>Unrated</Trans>
          </Text>
          <Show when={props.setup.options?.clock == null}>
            {'\u00a0· '}
            <FrameClockWords
              minutes={props.status?.minutes ?? 0}
              increment={props.status?.increment ?? 0}
            />
          </Show>
        </>
      }
      title={props.title}
      summary={props.goal}
      dataSet={{ testid: 'game-session-mode' }}
    />
  );
}

/**
 * The seat to fill while an open or closed seat holds the game back and the
 * viewer may choose who sits there: its own place offers the ways.
 */
function fillSeatOf(
  props: Props & { readonly setup: FrameSetup }
): FrameFillSeat | undefined {
  const reason = props.setup.start.reason?.kind;
  if (reason !== 'open-seats' && reason !== 'incomplete') return undefined;
  const seat = props.setup.seats.find(
    (each) =>
      each.choices !== null &&
      (each.holder.kind === 'open' || each.holder.kind === 'closed')
  );
  const choices = seat?.choices;
  if (seat === undefined || choices == null) return undefined;
  return {
    invite: choices.invitees !== null,
    onOpen: () => props.onOpen({ screen: 'seat', side: seat.side }),
  };
}

/**
 * Play Friend's lobby while the table is set up: who is invited and who
 * is ready, what is agreed, and the one thing to do next. Seats are
 * people. A bot game has its own lobby.
 */
export function PlayFriendSetupPlace(
  props: Props & { readonly setup: FrameSetup }
): JSX.Element {
  return (
    <FrameLobbyPage
      {...props}
      screenId="vs-human-setup"
      dock={
        <FrameStartView
          start={props.setup.start}
          watching={
            props.setup.start.readiness === null &&
            props.setup.takeSeat === null &&
            !props.setup.seats.some((seat) => seat.invitation?.mine === true)
          }
          invitedTo={
            props.setup.seats.find((seat) => seat.invitation?.mine === true)
              ?.sideLabel
          }
          onChoose={props.onChoose}
          onReady={props.onReady}
          fillSeat={fillSeatOf(props)}
          offline={props.connection === 'needed'}
          onArrange={
            props.setup.privateSetup === null
              ? undefined
              : () => props.onOpen({ screen: 'private-setup' })
          }
          seat={
            <>
              <InvitationAnswer {...props} setup={props.setup} />
              <Show when={props.setup.takeSeat}>
                {(side) => (
                  <GameActionButton
                    title={<Trans>Take a seat</Trans>}
                    variant="solid"
                    size="lg"
                    dataSet={{ testid: 'game-session-take-seat' }}
                    operation={() =>
                      props.onChoose({ operation: 'claim', side: side() })
                    }
                  />
                )}
              </Show>
            </>
          }
        />
      }
    >
      <LobbyMode {...props} />
      <For each={props.setup.seats}>
        {(seat) => <OwnInvitation {...props} seat={seat} />}
      </For>
      {/* An invitation to play says what to do; "watching" waits till
          it is answered. */}
      <Show
        when={
          props.setup.seats.some((seat) => seat.invitation?.mine === true)
            ? null
            : props.setup.viewerNotice
        }
      >
        {(text) => (
          <P tone="secondary" testId="game-session-viewer">
            {text()}
          </P>
        )}
      </Show>
      <MenuSection
        title={
          <Trans>
            Players · {seatedCount(props.setup.seats)} of{' '}
            {props.setup.seats.length}
          </Trans>
        }
        dataSet={{ testid: 'game-session-setup-seats' }}
      >
        <For keyed={false} each={props.setup.seats}>
          {(seat) => <SeatRow {...props} seat={seat()} />}
        </For>
      </MenuSection>
      <AgreedRows {...props} />
      {/* Calling the game off: last on the page, quiet, and it asks first. */}
      <Show when={props.play.canCancel}>
        <GameActions sizing="fill">
          <Button
            title={<Trans>Cancel game</Trans>}
            variant="ghost"
            intent="danger"
            size="md"
            onClick={() => props.onConfirm('cancel')}
            dataSet={{ testid: 'game-session-cancel' }}
          />
        </GameActions>
      </Show>
    </FrameLobbyPage>
  );
}
