import { Trans } from '@lingui/solid/macro';
import { Badge, HostBadge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import {
  GameModeCard,
  type GameModeFact,
} from '@pkgs/ui-root-client-ts/game-lobby';
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
import { For, Index, type JSX, Match, Show, Switch } from 'solid-js';
import {
  FrameHolderAvatar,
  FrameHolderName,
  FramePersonName,
} from './game-frame-people';
import type { FramePlaceProps } from './game-frame-screen-view';
import { FrameLobbyPage } from './game-frame-shell';
import { FrameStartView } from './game-frame-start-line-view';
import { FrameClockWords } from './game-frame-status-view';
import type {
  FrameOptions,
  FrameSetup,
  FrameSetupSeat,
} from './game-frame-view-types';

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
          dataSet={{ testid: `custom-game-${props.seat.side}-host` }}
        />
      </Show>
      <Show when={props.seat.visiting}>
        <Badge
          intent="info"
          size="sm"
          label={<Trans>You · guest</Trans>}
          dataSet={{ testid: `custom-game-${props.seat.side}-you` }}
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
            testId={`custom-game-${props.seat.side}-clock`}
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
          dataSet={{ testid: `custom-game-${props.seat.side}-invited` }}
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
          <Text variant="inherit" testId={`custom-game-${side()}-person`}>
            <FrameHolderName
              holder={props.seat.holder}
              plainName={props.seat.plainName}
              people={props.people}
            />
          </Text>
          <SeatTags seat={props.seat} />
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
          ? `custom-game-${side()}-choices`
          : `custom-game-${side()}`,
      }}
    />
  );
}

/** An invitation the viewer holds: answered here, where they land. */
function OwnInvitation(
  props: Props & { readonly seat: FrameSetupSeat }
): JSX.Element {
  const side = () => props.seat.side;
  return (
    <Show when={props.seat.invitation?.mine ? props.seat.invitation : null}>
      {(invitation) => (
        <Notice tone="info">
          <StackVertical gap="md">
            <P role="status" testId={`custom-game-${side()}-invitation`}>
              <FramePersonName
                person={invitation().inviter}
                plainName={invitation().inviterName}
                people={props.people}
                bold
              />{' '}
              <Trans>invites you to play {props.seat.sideLabel}.</Trans>
            </P>
            <Show when={invitation().canAnswer}>
              <GameActions>
                <GameActionButton
                  title={<Trans>Accept</Trans>}
                  variant="solid"
                  dataSet={{ testid: `custom-game-${side()}-accept` }}
                  operation={() =>
                    props.onChoose({ operation: 'accept', side: side() })
                  }
                />
                <GameActionButton
                  title={<Trans>Decline</Trans>}
                  dataSet={{ testid: `custom-game-${side()}-decline` }}
                  operation={() =>
                    props.onChoose({ operation: 'decline', side: side() })
                  }
                />
              </GameActions>
            </Show>
          </StackVertical>
        </Notice>
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
              leading={<SlidersHorizontalIcon size={24} />}
              title={<Trans>Options</Trans>}
              value={optionsSummary(shown())}
              onClick={() => props.onOpen({ screen: 'options' })}
              dataSet={{ testid: 'custom-game-rules' }}
            />
          )}
        </Show>
        <Show when={options()?.clock}>
          {(clock) => (
            <MenuRow
              leading={<ClockIcon size={24} />}
              title={<Trans>Clock and sides</Trans>}
              value={
                <FrameClockWords
                  minutes={clock().minutes}
                  increment={clock().increment}
                />
              }
              onClick={() => props.onOpen({ screen: 'clock' })}
              dataSet={{ testid: 'custom-game-options' }}
            />
          )}
        </Show>
        <Show when={props.setup.privateSetup}>
          {(own) => (
            <MenuRow
              leading={<LockIcon size={24} />}
              title={<Trans>Your private setup</Trans>}
              caption={<Trans>Only you see it</Trans>}
              // The row shows one word; a listener hears the whole sentence.
              value={
                <Text
                  variant="inherit"
                  role="status"
                  dataSet={{ testid: 'custom-game-setup-status' }}
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
              dataSet={{ testid: 'custom-game-setup-open' }}
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
 * it is won, then what is agreed (who is in, the clock, that it is
 * unrated) at a glance.
 */
function LobbyMode(props: Props & { readonly setup: FrameSetup }): JSX.Element {
  const facts = (): readonly GameModeFact[] => [
    {
      id: 'players',
      label: <Trans>Players</Trans>,
      value: (
        <Trans>
          {seatedCount(props.setup.seats)} of {props.setup.seats.length}
        </Trans>
      ),
    },
    {
      id: 'clock',
      label: <Trans>Clock</Trans>,
      value: (
        <FrameClockWords
          minutes={props.status?.minutes ?? 0}
          increment={props.status?.increment ?? 0}
        />
      ),
    },
    {
      id: 'rating',
      label: <Trans>Rating</Trans>,
      value: <Trans>Unrated</Trans>,
      testId: 'custom-game-unrated',
    },
  ];
  return (
    <GameModeCard
      eyebrow={<Trans>Custom game</Trans>}
      title={props.title}
      summary={props.goal}
      facts={facts()}
      dataSet={{ testid: 'custom-game-mode' }}
    />
  );
}

/**
 * The lobby while a game is set up, as a lobby reads in any game: what is
 * played, who is in and who is ready, what is agreed, and under them, in
 * a dock that never scrolls, the one thing to do next (take a seat, get
 * ready, start). Each seat and each agreed thing is a row that opens its
 * own place; nothing is changed here.
 */
export function FrameLobbyPlace(
  props: Props & { readonly setup: FrameSetup }
): JSX.Element {
  return (
    <FrameLobbyPage
      {...props}
      screenId="custom-game-lobby"
      dock={
        <FrameStartView
          start={props.setup.start}
          onChoose={props.onChoose}
          onReady={props.onReady}
          onArrange={
            props.setup.privateSetup === null
              ? undefined
              : () => props.onOpen({ screen: 'private-setup' })
          }
          seat={
            <Show when={props.setup.takeSeat}>
              {(side) => (
                <GameActionButton
                  title={<Trans>Take a seat</Trans>}
                  variant="solid"
                  size="lg"
                  dataSet={{ testid: 'custom-game-take-seat' }}
                  operation={() =>
                    props.onChoose({ operation: 'claim', side: side() })
                  }
                />
              )}
            </Show>
          }
        />
      }
    >
      <LobbyMode {...props} />
      <For each={props.setup.seats}>
        {(seat) => <OwnInvitation {...props} seat={seat} />}
      </For>
      <Show when={props.setup.viewerNotice}>
        {(text) => (
          <P tone="secondary" testId="custom-game-viewer">
            {text()}
          </P>
        )}
      </Show>
      <MenuSection
        title={<Trans>Players</Trans>}
        dataSet={{ testid: 'custom-game-setup-seats' }}
      >
        <Index each={props.setup.seats}>
          {(seat) => <SeatRow {...props} seat={seat()} />}
        </Index>
      </MenuSection>
      <AgreedRows {...props} />
      {/* Calling the game off: last on the page, quiet, and it asks first. */}
      <Show when={props.play.canCancel}>
        <GameActions>
          <Button
            title={<Trans>Cancel game</Trans>}
            variant="ghost"
            intent="danger"
            size="sm"
            onClick={() => props.onConfirm('cancel')}
            dataSet={{ testid: 'custom-game-cancel' }}
          />
        </GameActions>
      </Show>
    </FrameLobbyPage>
  );
}
