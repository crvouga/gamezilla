import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import { Trans } from '@lingui/solid/macro';
import { Badge, HostBadge } from '@pkgs/ui-root-client-ts/badge';
import { Divider } from '@pkgs/ui-root-client-ts/divider';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import {
  GAME_PLAYER_COMPACT_AVATAR_SIZE,
  GamePlayerBar,
} from '@pkgs/ui-root-client-ts/game-player-bar';
import { GameSeatReadiness } from '@pkgs/ui-root-client-ts/game-player-parts';
import { GameActions, GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
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
};

/** Holders whose readiness the seat shows: a person, a guest here, a bot. */
function showsReadiness(seat: FrameSetupSeat): boolean {
  const kind = seat.holder.kind;
  return kind === 'person' || kind === 'local' || kind === 'bot';
}

/**
 * The seat's facts in one line: the side's name in words (the swatch shows
 * its look), one tag for the host's own seat or the viewer's seat at
 * someone else's table, and whether its holder is ready as a dot and a
 * word. Open, closed and invited seats show no readiness.
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
 * One seat while the game is set up, as one compact row: who holds it, its
 * look and facts, and one trailing control; its other choices wait behind
 * that control. Once the game is played the board's seats show it.
 */
function SetupSeatView(props: SeatProps): JSX.Element {
  return (
    <GamePlayerBar
      density="compact"
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
      optionsLabel={<Trans>Change</Trans>}
      optionsDataSet={{ testid: `custom-game-${props.seat.side}-choices` }}
    >
      <Show when={props.seat.invitation}>
        {(invitation) => (
          <FrameInvitationView {...props} invitation={invitation()} />
        )}
      </Show>
    </GamePlayerBar>
  );
}

/**
 * Every seat while the game is set up, each with its own choices. A person
 * who may take a seat sits in the first open one; someone who may not, or
 * finds every seat taken, is told they watch.
 */
export function FrameSetupSeatsView(props: {
  readonly setup: FrameSetup;
  readonly people?: FramePeople | undefined;
  readonly onChoose: Choose;
}): JSX.Element {
  return (
    <GameSection title={<Trans>Players</Trans>}>
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
      <Index each={props.setup.seats}>
        {(seat, index) => (
          <>
            <Show when={index > 0}>
              <Divider />
            </Show>
            <SetupSeatView
              seat={seat()}
              people={props.people}
              onChoose={props.onChoose}
            />
          </>
        )}
      </Index>
    </GameSection>
  );
}
