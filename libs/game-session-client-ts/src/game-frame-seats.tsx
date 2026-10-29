import type {
  CustomGame,
  CustomGameSide,
} from '@libs/game-session-shared-ts/custom-game-state';
import { UserProfileAvatar } from '@libs/profile-client-ts/user-profile-avatar';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { useGamePresentation } from '@pkgs/turn-game-client-ts/turn-games-context';
import { useGameSideLabel } from '@pkgs/turn-game-client-ts/use-game-side-label';
import type { GameFrame } from '@pkgs/turn-game-shared-ts/game-frame';
import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import {
  GAME_PLAYER_AVATAR_SIZE,
  GamePlayerBar,
} from '@pkgs/ui-root-client-ts/game-player-bar';
import type {
  GamePlayerState,
  GameSeatStat,
} from '@pkgs/ui-root-client-ts/game-player-parts';
import {
  GAME_PLAYER_CHIP_AVATAR_SIZE,
  GamePlayerChip,
  GamePlayerRail,
} from '@pkgs/ui-root-client-ts/game-player-rail';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { For, type JSX, Match, Show, Switch } from 'solid-js';
import { CustomGamePerson, useBotLevel } from './custom-game-person';
import {
  CustomGameClock,
  useClockLabel,
  useSeatName,
} from './custom-game-status';
import { frameSwatch } from './game-frame-look';
import { useFramePlayerPress } from './game-frame-player-press';
import type { FrameTable } from './game-frame-table';
import type { CustomGameScreenModel } from './use-custom-game-screen';

/** One seat of the game under way, in the position the board shows. */
type SeatProps = {
  readonly model: CustomGameScreenModel;
  readonly side: CustomGameSide;
  readonly position: string;
};

type TableProps = {
  readonly model: CustomGameScreenModel;
  readonly table: FrameTable;
  readonly position: string;
};

function liveGame(model: CustomGameScreenModel): CustomGame {
  return model.current()!;
}

function useFrame(model: CustomGameScreenModel): () => GameFrame<JSX.Element> {
  const presentation = useGamePresentation();
  return () => presentation(liveGame(model).fen).frame;
}

/** A person's picture, the bot, or the person placeholder for anyone else. */
export function FrameSeatAvatar(props: {
  readonly model: CustomGameScreenModel;
  readonly side: CustomGameSide;
  readonly size: number;
}): JSX.Element {
  const participant = () => liveGame(props.model)[props.side];
  return (
    <Switch fallback={<Avatar size={props.size} />}>
      <Match when={participant().kind === 'person'}>
        <UserProfileAvatar profileId={participant().person} size={props.size} />
      </Match>
      <Match when={participant().kind === 'bot'}>
        <Avatar size={props.size} kind="bot" />
      </Match>
    </Switch>
  );
}

/** Whether `side` decides now: its turn, or its secret choice still open. */
function seatDeciding(game: CustomGame, side: CustomGameSide): boolean {
  if (game.status !== 'active') return false;
  return game.awaiting.length > 0
    ? game.awaiting.includes(side)
    : game.turn === side;
}

/** Out of play in the position, or a person away right now. */
function useSeatState(props: SeatProps): () => GamePlayerState | null {
  const frame = useFrame(props.model);
  return () => {
    if (frame().seats.out(props.position, props.side))
      return { kind: 'out', label: t`Out` };
    const participant = liveGame(props.model)[props.side];
    return participant.kind === 'person' &&
      props.model.awaySince(participant.person) !== null
      ? { kind: 'reconnecting', label: t`Reconnecting` }
      : null;
  };
}

/** What tapping the seat's holder does, or `undefined` when nothing. */
function useSeatPress(props: SeatProps): () => (() => void) | undefined {
  const press = useFramePlayerPress(props.model.myId);
  return () => {
    const participant = liveGame(props.model)[props.side];
    return participant.kind === 'person'
      ? press(participant.person)
      : undefined;
  };
}

/**
 * The seat's public facts as tags: a stand-in bot playing it, whether it has
 * made its secret choice (never what), and the game's own facts.
 */
function SeatTags(props: SeatProps): JSX.Element {
  const frame = useFrame(props.model);
  const game = () => liveGame(props.model);
  const facts = () =>
    frame().seats.facts(props.position, props.side, game().committed);
  return (
    <>
      <Show when={game().standIns.includes(props.side)}>
        <Badge
          intent="warning"
          label={<Trans>Stand-in bot</Trans>}
          dataSet={{ testid: `custom-game-${props.side}-stand-in` }}
        />
      </Show>
      <Show when={game().committed.includes(props.side)}>
        <Badge
          intent="success"
          label={<Trans>Chosen</Trans>}
          dataSet={{ testid: `custom-game-${props.side}-committed` }}
        />
      </Show>
      <Show when={game().awaiting.includes(props.side)}>
        <Badge intent="neutral" label={<Trans>Choosing</Trans>} />
      </Show>
      <For each={facts()}>
        {(fact) => <Badge intent="neutral" label={fact} />}
      </For>
    </>
  );
}

/** The person whose side a stand-in plays takes it back. */
function TakeBackSide(props: SeatProps): JSX.Element {
  const game = () => liveGame(props.model);
  return (
    <Show
      when={
        game().status === 'active' &&
        game().standIns.includes(props.side) &&
        game()[props.side].person === props.model.myId() &&
        props.model.canPlay()
      }
    >
      <GameActionButton
        title={<Trans>Take back my side</Trans>}
        variant="solid"
        dataSet={{ testid: 'custom-game-reclaim' }}
        operation={() => props.model.choose({ operation: 'reclaim' })}
      />
    </Show>
  );
}

/**
 * One seat as a full strip: who holds it, its look and side, its facts, its
 * figure and its clock. The seat nearest the person, and the one opponent
 * across a two-seat board.
 */
export function FrameSeatStrip(props: SeatProps): JSX.Element {
  const frame = useFrame(props.model);
  const level = useBotLevel(props);
  const state = useSeatState(props);
  const press = useSeatPress(props);
  const gameSideLabel = useGameSideLabel();
  const game = () => liveGame(props.model);
  return (
    <GamePlayerBar
      dataSet={{ testid: `custom-game-${props.side}` }}
      name={
        <Text variant="inherit" testId={`custom-game-${props.side}-person`}>
          <CustomGamePerson participant={game()[props.side]} level={level()} />
        </Text>
      }
      avatar={
        <FrameSeatAvatar
          model={props.model}
          side={props.side}
          size={GAME_PLAYER_AVATAR_SIZE}
        />
      }
      swatch={frameSwatch(frame().seats.look(props.side))}
      tags={
        <>
          <Badge
            intent="neutral"
            label={gameSideLabel(game().fen, props.side)}
          />
          <SeatTags {...props} />
        </>
      }
      stat={frame().seats.stat(props.position, props.side)}
      state={state()}
      trailing={
        game().minutes > 0 ? (
          <CustomGameClock game={game()} side={props.side} />
        ) : undefined
      }
      active={seatDeciding(game(), props.side)}
      onPress={press()}
    >
      <TakeBackSide {...props} />
    </GamePlayerBar>
  );
}

/** The seat's figure on a chip: the game's own, else its running clock. */
function useChipStat(props: SeatProps): () => GameSeatStat | null {
  const frame = useFrame(props.model);
  const clock = useClockLabel({
    get game() {
      return liveGame(props.model);
    },
    side: props.side,
  });
  return () =>
    frame().seats.stat(props.position, props.side) ??
    (liveGame(props.model).minutes > 0
      ? { label: t`Time`, value: clock() }
      : null);
}

/** One of three or more other seats, as a compact chip in the rail. */
export function FrameSeatChip(props: SeatProps): JSX.Element {
  const frame = useFrame(props.model);
  const name = useSeatName(props.model, props.side);
  const state = useSeatState(props);
  const press = useSeatPress(props);
  const stat = useChipStat(props);
  return (
    <GamePlayerChip
      dataSet={{ testid: `custom-game-${props.side}` }}
      name={name()}
      avatar={
        <FrameSeatAvatar
          model={props.model}
          side={props.side}
          size={GAME_PLAYER_CHIP_AVATAR_SIZE}
        />
      }
      swatch={frameSwatch(frame().seats.look(props.side))}
      tags={<SeatTags {...props} />}
      stat={stat()}
      state={state()}
      active={seatDeciding(liveGame(props.model), props.side)}
      onPress={press()}
    />
  );
}

/**
 * The other seats, above the board: the one opponent's full strip, or a
 * rail of chips at a bigger table; nothing at a solo table.
 */
export function FrameOthers(props: TableProps): JSX.Element {
  return (
    <Switch>
      <Match when={props.table.shape === 'strip' && props.table.others[0]}>
        {(side) => (
          <FrameSeatStrip
            model={props.model}
            side={side()}
            position={props.position}
          />
        )}
      </Match>
      <Match when={props.table.shape === 'rail'}>
        <GamePlayerRail aria-label={t`Other players`}>
          <For each={props.table.others}>
            {(side) => (
              <FrameSeatChip
                model={props.model}
                side={side}
                position={props.position}
              />
            )}
          </For>
        </GamePlayerRail>
      </Match>
    </Switch>
  );
}

/** The seat below the board, nearest the person holding the device. */
export function FrameNearSeat(props: TableProps): JSX.Element {
  return (
    <Show when={props.table.near} keyed>
      {(side) => (
        <StackVertical testId="custom-game-seat-near">
          <FrameSeatStrip
            model={props.model}
            side={side}
            position={props.position}
          />
        </StackVertical>
      )}
    </Show>
  );
}
