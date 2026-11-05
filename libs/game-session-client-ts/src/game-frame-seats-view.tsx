import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import { Trans } from '@lingui/solid/macro';
import { Badge, HostBadge } from '@pkgs/ui-root-client-ts/badge';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import {
  GAME_PLAYER_COMPACT_AVATAR_SIZE,
  GamePlayerBar,
} from '@pkgs/ui-root-client-ts/game-player-bar';
import { GameSeatReadiness } from '@pkgs/ui-root-client-ts/game-player-parts';
import { GameActions, GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { Index, type JSX, Show } from 'solid-js';
import { FrameHolderAvatar, FrameHolderName } from './game-frame-people';
import {
  FrameInvitationView,
  FrameSeatChoicesView,
} from './game-frame-seat-choices-view';
import { FrameSeatClock } from './game-frame-table-view';
import type {
  FramePeople,
  FrameSetup,
  FrameSetupSeat,
} from './game-frame-view-types';

type Choose = (input: CustomGameInput) => Promise<void>;

type SeatProps = {
  readonly seat: FrameSetupSeat;
  readonly people?: FramePeople | undefined;
  readonly onChoose: Choose;
  /** Under the viewer's own seat: their readiness, when they may start. */
  readonly ownReadiness?: JSX.Element | undefined;
};

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
 * The seat's facts in one line: the side's name in words (the swatch shows
 * its look), one tag for the host's own seat or the viewer's seat at
 * someone else's table, and whether its holder is ready as a dot and a
 * word. Bots, open, closed and invited seats show no readiness.
 */
function SetupSeatTags(props: { readonly seat: FrameSetupSeat }): JSX.Element {
  return (
    <>
      <Text variant="caption">{props.seat.sideLabel}</Text>
      <Show when={props.seat.host}>
        <HostBadge
          dataSet={{ testid: `custom-game-${props.seat.side}-host` }}
        />
      </Show>
      <Show when={props.seat.visiting}>
        <Badge
          intent="info"
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
    </>
  );
}

/** Leave the seat the viewer holds. */
function LeaveSeatButton(props: SeatProps): JSX.Element {
  return (
    <GameActionButton
      title={<Trans>Leave seat</Trans>}
      size="sm"
      dataSet={{ testid: `custom-game-${props.seat.side}-release` }}
      operation={() =>
        props.onChoose({ operation: 'release', side: props.seat.side })
      }
    />
  );
}

/**
 * The seat's one trailing control beside its clock: sit in an open seat,
 * or leave one's own when there is nothing else to change about it.
 */
function SetupSeatTrailing(props: SeatProps): JSX.Element {
  return (
    <>
      <Show when={props.seat.clock}>
        {(clock) => <FrameSeatClock seat={props.seat} clock={clock()} />}
      </Show>
      <Show when={props.seat.canSit}>
        <GameActionButton
          title={<Trans>Sit here</Trans>}
          variant="solid"
          size="sm"
          dataSet={{ testid: `custom-game-${props.seat.side}-claim` }}
          operation={() =>
            props.onChoose({ operation: 'claim', side: props.seat.side })
          }
        />
      </Show>
      <Show when={props.seat.canLeave && props.seat.choices === null}>
        <LeaveSeatButton {...props} />
      </Show>
    </>
  );
}

/** Behind the seat's toggle: leaving it, and who else may sit there. */
function SetupSeatOptions(props: SeatProps): JSX.Element {
  return (
    <Show when={props.seat.choices}>
      {(choices) => (
        <>
          <Show when={props.seat.canLeave}>
            <GameActions>
              <LeaveSeatButton {...props} />
            </GameActions>
          </Show>
          <FrameSeatChoicesView {...props} choices={choices()} />
        </>
      )}
    </Show>
  );
}

/**
 * What the seat's toggle changes, in full on every size: the player (and,
 * for assistive technology, which side's). The toggle sits on its own line
 * under the name, so both read whole.
 */
function SeatOptionsLabel(props: {
  readonly seat: FrameSetupSeat;
}): JSX.Element {
  return (
    <Trans>
      Change player
      <VisuallyHidden>: {props.seat.sideLabel}</VisuallyHidden>
    </Trans>
  );
}

/**
 * One seat while the game is set up, as a compact player row on every
 * size: who holds it, its look and readiness, then on the line under the
 * name every control the seat has (Change player, I'm not ready), so a
 * player's actions sit with the player, never across the card. Its other
 * choices open under it. Once the game is played the board's seats show it.
 */
function SetupSeatView(props: SeatProps): JSX.Element {
  return (
    <GamePlayerBar
      density="compact"
      optionsPlacement="below"
      dataSet={{ testid: `custom-game-${props.seat.side}` }}
      swatch={props.seat.swatch}
      name={
        <Text
          variant="inherit"
          testId={`custom-game-${props.seat.side}-person`}
        >
          <FrameHolderName
            holder={props.seat.holder}
            plainName={props.seat.plainName}
            people={props.people}
          />
        </Text>
      }
      avatar={
        <FrameHolderAvatar
          holder={props.seat.holder}
          plainName={props.seat.plainName}
          size={GAME_PLAYER_COMPACT_AVATAR_SIZE}
          setup
          people={props.people}
        />
      }
      tags={<SetupSeatTags seat={props.seat} />}
      trailing={<SetupSeatTrailing {...props} />}
      options={<SetupSeatOptions {...props} />}
      optionsLabel={<SeatOptionsLabel seat={props.seat} />}
      optionsDataSet={{ testid: `custom-game-${props.seat.side}-choices` }}
    >
      <Show when={props.seat.invitation}>
        {(invitation) => (
          <FrameInvitationView {...props} invitation={invitation()} />
        )}
      </Show>
      <Show when={props.seat.own}>{props.ownReadiness}</Show>
    </GamePlayerBar>
  );
}

/**
 * Every seat while the game is set up, one plain list of player rows in
 * the Players card (never cards inside the card), each holding its own
 * choices, one seat to a row, with the board preview beside them: wide,
 * the Players card and the preview's card are two equal columns, Start
 * closing the Players card at its foot. A person who may take a seat sits in the
 * first open one; someone who may not, or finds every seat taken, is told
 * they watch.
 */
export function FrameSetupSeatsView(props: {
  readonly setup: FrameSetup;
  readonly people?: FramePeople | undefined;
  readonly onChoose: Choose;
  /** Under the viewer's own seat: their readiness, when they may start. */
  readonly ownReadiness?: JSX.Element | undefined;
  /** Starting the game, when this is the last setup card. */
  readonly footer?: JSX.Element | undefined;
  /** The board the game is played on, in its own card paired with the seats. */
  readonly media?: JSX.Element | undefined;
}): JSX.Element {
  return (
    <GameSection
      title={<Trans>Players</Trans>}
      footer={props.footer}
      media={props.media}
    >
      <Show when={props.setup.viewerNotice}>
        {(text) => (
          <P tone="secondary" testId="custom-game-viewer">
            {text()}
          </P>
        )}
      </Show>
      <Show when={props.setup.takeSeat}>
        {(side) => (
          <GameActions>
            <GameActionButton
              title={<Trans>Take a seat</Trans>}
              dataSet={{ testid: 'custom-game-take-seat' }}
              operation={() =>
                props.onChoose({ operation: 'claim', side: side() })
              }
            />
          </GameActions>
        )}
      </Show>
      <StackVertical gap="sm" testId="custom-game-setup-seats">
        <Index each={props.setup.seats}>
          {(seat) => (
            <SetupSeatView
              seat={seat()}
              people={props.people}
              onChoose={props.onChoose}
              ownReadiness={props.ownReadiness}
            />
          )}
        </Index>
      </StackVertical>
    </GameSection>
  );
}
