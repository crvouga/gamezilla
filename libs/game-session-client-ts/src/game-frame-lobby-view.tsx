import { Trans } from '@lingui/solid/macro';
import { Badge, HostBadge } from '@pkgs/ui-root-client-ts/badge';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameSeatReadiness } from '@pkgs/ui-root-client-ts/game-player-parts';
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
import { For, Index, type JSX, Show } from 'solid-js';
import {
  FrameHolderAvatar,
  FrameHolderName,
  FramePersonName,
} from './game-frame-people';
import type { FramePlaceProps } from './game-frame-screen-view';
import { FramePlacePage } from './game-frame-shell';
import { FrameStartView } from './game-frame-start-line-view';
import { FrameFactsView } from './game-frame-status-view';
import { FrameSeatClock } from './game-frame-table-view';
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
 * The seat's facts under its holder's name: the side's look and name, one
 * tag for the host's own seat or the viewer's seat at someone else's
 * table, and whether its holder is ready as a dot and a word.
 */
function SeatFacts(props: { readonly seat: FrameSetupSeat }): JSX.Element {
  return (
    <StackHorizontal gap="sm" align="center" wrap>
      <GameSeatSwatch look={props.seat.swatch} />
      <Text variant="caption">{props.seat.sideLabel}</Text>
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
      <Show when={showsReadiness(props.seat)}>
        <GameSeatReadiness
          ready={props.seat.ready}
          label={
            props.seat.ready ? (
              <Trans>Ready</Trans>
            ) : (
              <Trans>Getting ready</Trans>
            )
          }
        />
      </Show>
    </StackHorizontal>
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
        <Text variant="inherit" testId={`custom-game-${side()}-person`}>
          <FrameHolderName
            holder={props.seat.holder}
            plainName={props.seat.plainName}
            people={props.people}
          />
        </Text>
      }
      caption={<SeatFacts seat={props.seat} />}
      value={
        <Show when={props.seat.clock}>
          {(clock) => <FrameSeatClock seat={props.seat} clock={clock()} />}
        </Show>
      }
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
        props.setup.privateSetup !== null ||
        props.play.canCancel
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
                <Show
                  when={clock().minutes > 0}
                  fallback={<Trans>Untimed</Trans>}
                >
                  {clock().minutes}+{clock().increment}
                </Show>
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
              value={
                <Show
                  when={own().complete}
                  fallback={<Trans>Incomplete</Trans>}
                >
                  <Trans>Complete</Trans>
                </Show>
              }
              onClick={() => props.onOpen({ screen: 'private-setup' })}
              dataSet={{ testid: 'custom-game-setup-open' }}
            />
          )}
        </Show>
        <Show when={props.play.canCancel}>
          <MenuRow
            title={<Trans>Cancel game</Trans>}
            tone="destructive"
            hideChevron
            onClick={() => props.onConfirm('cancel')}
            dataSet={{ testid: 'custom-game-cancel' }}
          />
        </Show>
      </MenuSection>
    </Show>
  );
}

/**
 * The lobby while a game is set up: who sits where, what is agreed, and
 * the one thing to do next (take a seat, answer an invitation, get ready,
 * start). Each seat and each agreed thing is a row that opens its own
 * place; nothing is changed here.
 */
export function FrameLobbyPlace(
  props: Props & { readonly setup: FrameSetup }
): JSX.Element {
  return (
    <FramePlacePage
      {...props}
      screenId="custom-game-lobby"
      title={props.title}
      subtitle={<FrameFactsView status={props.status} />}
    >
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
      <Show when={props.setup.takeSeat}>
        {(side) => (
          <GameActions sizing="share">
            <GameActionButton
              title={<Trans>Take a seat</Trans>}
              variant="solid"
              dataSet={{ testid: 'custom-game-take-seat' }}
              operation={() =>
                props.onChoose({ operation: 'claim', side: side() })
              }
            />
          </GameActions>
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
      <FrameStartView
        start={props.setup.start}
        onChoose={props.onChoose}
        onReady={props.onReady}
      />
    </FramePlacePage>
  );
}
