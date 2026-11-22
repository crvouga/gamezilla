import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import type { StageOverlayPhase } from '@pkgs/turn-game-client-ts/stage-overlay';
import {
  GAME_VERSUS_AVATAR_SIZE,
  GameVersusOverlay,
  type GameVersusSide,
} from '@pkgs/ui-root-client-ts/game-stage-overlay';
import { type JSX, Show } from 'solid-js';
import { FrameHolderAvatar, FrameHolderName } from './game-frame-people';
import type { FramePlaceProps } from './game-frame-screen-view';
import type {
  FramePeople,
  FramePhase,
  FramePlaySeat,
} from './game-frame-view-types';

type Props = FramePlaceProps;

/** Where the game stands, as the stage's overlay cares. */
export function frameOverlayPhase(phase: FramePhase): StageOverlayPhase {
  if (phase === 'active') return 'play';
  if (phase === 'none') return 'unknown';
  return phase === 'configuring' ? 'setup' : 'over';
}

function versusSide(
  seat: FramePlaySeat,
  people: FramePeople | undefined
): GameVersusSide {
  return {
    id: seat.side,
    name: (
      <FrameHolderName
        holder={seat.holder}
        plainName={seat.plainName}
        people={people}
      />
    ),
    avatar: (
      <FrameHolderAvatar
        holder={seat.holder}
        plainName={seat.plainName}
        size={GAME_VERSUS_AVATAR_SIZE}
        people={people}
      />
    ),
    swatch: seat.swatch,
    caption: seat.sideLabel,
  };
}

/**
 * The two bands of the versus card: the viewer's own seat below and the
 * rest above; a watched table is split in two, in seat order.
 */
function versusBands(props: Props): {
  readonly others: readonly GameVersusSide[];
  readonly own: readonly GameVersusSide[];
} {
  const side = (seat: FramePlaySeat) => versusSide(seat, props.people);
  const { near, others } = props.table;
  if (near !== null) return { others: others.map(side), own: [side(near)] };
  const half = Math.ceil(others.length / 2);
  return {
    others: others.slice(0, half).map(side),
    own: others.slice(half).map(side),
  };
}

function FrameVersusCard(
  props: Props & { readonly count: number }
): JSX.Element {
  const bands = () => versusBands(props);
  return (
    <GameVersusOverlay
      others={bands().others}
      own={bands().own}
      mark={<Trans>VS</Trans>}
      count={props.count}
      countLabel={<Trans>Starts in</Trans>}
      skipLabel={<Trans>Start now</Trans>}
      aria-label={
        props.status === null
          ? t`The game is starting.`
          : t`${props.status.lineup} The game is starting.`
      }
      onSkip={() => props.onOverlay({ type: 'skip' })}
      dataSet={{ testid: 'custom-game-versus', count: String(props.count) }}
    />
  );
}

/**
 * Over the stage while a game this device watched begin starts: who plays
 * whom and the count in (`StageOverlay`'s versus card), else nothing. How
 * the game ended is the stage's status line, never a card over the board.
 */
export function FrameVersusView(props: Props): JSX.Element {
  return (
    <Show when={props.overlay.kind === 'versus' ? props.overlay : null}>
      {(versus) => <FrameVersusCard {...props} count={versus().count} />}
    </Show>
  );
}
