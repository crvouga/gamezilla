import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import { Trans } from '@lingui/solid/macro';
import { Badge, HostBadge } from '@pkgs/ui-root-client-ts/badge';
import { Divider } from '@pkgs/ui-root-client-ts/divider';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameDisclosure } from '@pkgs/ui-root-client-ts/game-disclosure';
import {
  GAME_PLAYER_AVATAR_SIZE,
  GamePlayerBar,
} from '@pkgs/ui-root-client-ts/game-player-bar';
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

/**
 * The seat's colour, the host's tag on the host's own seat, the viewer's
 * own seat at someone else's table, and whether its holder is ready.
 */
function SetupSeatTags(props: { readonly seat: FrameSetupSeat }): JSX.Element {
  return (
    <>
      <Badge intent="neutral" label={props.seat.sideLabel} />
      <Show when={props.seat.host}>
        <HostBadge
          size="sm"
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
      <Show
        when={props.seat.ready}
        fallback={
          <Badge intent="neutral" label={<Trans>Getting ready</Trans>} />
        }
      >
        <Badge intent="success" label={<Trans>Ready</Trans>} />
      </Show>
    </>
  );
}

/** What the viewer may do with one seat while the game is set up. */
function SetupSeatActions(props: SeatProps): JSX.Element {
  const side = () => props.seat.side;
  return (
    <>
      <Show when={props.seat.invitation}>
        {(invitation) => (
          <FrameInvitationView {...props} invitation={invitation()} />
        )}
      </Show>
      {/* The seat's commands keep their own width, side by side. */}
      <GameActions>
        <Show when={props.seat.canSit}>
          <GameActionButton
            title={<Trans>Sit here</Trans>}
            variant="solid"
            dataSet={{ testid: `custom-game-${side()}-claim` }}
            operation={() =>
              props.onChoose({ operation: 'claim', side: side() })
            }
          />
        </Show>
        <Show when={props.seat.canLeave}>
          <GameActionButton
            title={<Trans>Leave seat</Trans>}
            dataSet={{ testid: `custom-game-${side()}-release` }}
            operation={() =>
              props.onChoose({ operation: 'release', side: side() })
            }
          />
        </Show>
      </GameActions>
      <Show when={props.seat.choices}>
        {(choices) => (
          <GameDisclosure
            title={<Trans>Change who sits here</Trans>}
            dataSet={{ testid: `custom-game-${side()}-choices` }}
          >
            <FrameSeatChoicesView {...props} choices={choices()} />
          </GameDisclosure>
        )}
      </Show>
    </>
  );
}

/**
 * One seat while the game is set up: who holds it, its look, its clock and
 * the choices for it. Once the game is played the board's seats show it.
 */
function SetupSeatView(props: SeatProps): JSX.Element {
  return (
    <GamePlayerBar
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
          size={GAME_PLAYER_AVATAR_SIZE}
          setup
          people={props.people}
        />
      }
      tags={<SetupSeatTags seat={props.seat} />}
      trailing={
        props.seat.clock === null ? undefined : (
          <FrameSeatClock seat={props.seat} clock={props.seat.clock} />
        )
      }
    >
      <SetupSeatActions {...props} />
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
