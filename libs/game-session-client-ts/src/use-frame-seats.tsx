import type {
  CustomGame,
  CustomGameParticipant,
  CustomGameSide,
} from '@libs/game-session-shared-ts/custom-game-state';
import { CUSTOM_GAME_SIDES } from '@libs/game-session-shared-ts/custom-game-state';
import { t } from '@lingui/core/macro';
import {
  useGamePresentation,
  useTurnGames,
} from '@pkgs/turn-game-client-ts/turn-games-context';
import { useGameSideLabel } from '@pkgs/turn-game-client-ts/use-game-side-label';
import type { BotDifficulty } from '@pkgs/turn-game-shared-ts/game-rules';
import type { GamePlayerState } from '@pkgs/ui-root-client-ts/game-player-parts';
import { type Accessor, createMemo } from 'solid-js';
import { useBotLevel } from './custom-game-person';
import {
  usePersonName,
  useSeatNames,
  useSideClocks,
} from './custom-game-status';
import { frameSwatch } from './game-frame-look';
import type { FrameBoard } from './game-frame-play';
import { useFramePlayerPress } from './game-frame-player-press';
import { frameTable, sameTable } from './game-frame-table';
import type {
  FrameHolder,
  FramePlaySeat,
  FrameSeat,
  FrameSeatChoices,
  FrameSetupSeat,
  FrameTable,
} from './game-frame-view-types';
import type { CustomGameScreenModel } from './use-custom-game-screen';

/** A participant as the frame names its holder. */
export function holderOf(
  participant: CustomGameParticipant,
  level: BotDifficulty | undefined
): FrameHolder {
  switch (participant.kind) {
    case 'person':
    case 'invitation':
      return { kind: participant.kind, person: participant.person };
    case 'bot':
      return { kind: 'bot', level };
    default:
      return { kind: participant.kind };
  }
}

/**
 * Whether `side` decides now: its turn, or its secret choice still open.
 * The viewer's own seat stops deciding while their choice is being sent.
 */
export function frameSeatDeciding(
  game: CustomGame,
  side: CustomGameSide,
  model: Pick<CustomGameScreenModel, 'mySide' | 'submitting'>
): boolean {
  if (game.status !== 'active') return false;
  if (model.submitting() && model.mySide() === side) return false;

  return game.awaiting.length > 0
    ? game.awaiting.includes(side)
    : game.turn === side;
}

/** One seat's identity, read live: who, their look, side and clock. */
function useFrameSeat(model: CustomGameScreenModel) {
  const presentation = useGamePresentation();
  const gameSideLabel = useGameSideLabel();
  const names = useSeatNames(model);
  const clocks = useSideClocks(model);
  const levels = Object.fromEntries(
    CUSTOM_GAME_SIDES.map((side) => [side, useBotLevel({ model, side })])
  ) as Record<CustomGameSide, () => BotDifficulty | undefined>;
  return (game: CustomGame, side: CustomGameSide): FrameSeat => ({
    side,
    sideLabel: gameSideLabel(game.fen, side),
    holder: holderOf(game[side], levels[side]()),
    plainName: names[side](),
    swatch: frameSwatch(presentation(game.fen).frame.seats.look(side)),
    clock: clocks[side](),
  });
}

/** Out of play in the position, or a person away right now. */
function seatState(
  model: CustomGameScreenModel,
  out: boolean,
  participant: CustomGameParticipant
): GamePlayerState | null {
  if (out) return { kind: 'out', label: t`Out` };
  return participant.kind === 'person' &&
    model.awaySince(participant.person) !== null
    ? { kind: 'reconnecting', label: t`Reconnecting` }
    : null;
}

/**
 * The seats around the board while the game is played, in the position
 * the board shows: the other seats above, the viewer's own (or the first,
 * for a watcher) nearest them.
 */
export function useFrameTable(
  model: CustomGameScreenModel,
  board: FrameBoard
): Accessor<FrameTable> {
  const presentation = useGamePresentation();
  const seat = useFrameSeat(model);
  const press = useFramePlayerPress(model.myId);
  const layout = createMemo(
    () => frameTable(model.current()?.sides ?? [], model.mySide()),
    undefined,
    { equals: sameTable }
  );
  const playSeat = (game: CustomGame, side: CustomGameSide): FramePlaySeat => {
    const position = board.position();
    const seats = presentation(game.fen).frame.seats;
    const participant = game[side];
    return {
      ...seat(game, side),
      stat: seats.stat(position, side),
      state: seatState(model, seats.out(position, side), participant),
      standIn: game.standIns.includes(side),
      committed: game.committed.includes(side),
      choosing: game.awaiting.includes(side),
      facts: seats.facts(position, side, game.committed),
      deciding: frameSeatDeciding(game, side, model),
      reclaim:
        game.status === 'active' &&
        game.standIns.includes(side) &&
        participant.person === model.myId() &&
        model.canPlay(),
      onPress:
        participant.kind === 'person' ? press(participant.person) : undefined,
    };
  };
  return createMemo((): FrameTable => {
    const game = model.current();
    const table = layout();
    if (game === null) return { shape: 'none', near: null, others: [] };
    return {
      shape:
        presentation(game.fen).frame.boardSeats === true &&
        table.shape !== 'none'
          ? 'board'
          : table.shape,
      named: presentation(game.fen).frame.boardNames === true,
      near: table.near === null ? null : playSeat(game, table.near),
      others: table.others.map((side) => playSeat(game, side)),
    };
  });
}

/** What the host may put in a seat; `null` when they may not change it. */
function useSeatChoices(model: CustomGameScreenModel) {
  const rules = useTurnGames();
  return (game: CustomGame, side: CustomGameSide): FrameSeatChoices | null => {
    if (!model.canConfigure()) return null;
    const custom = rules.capability(
      rules.forPosition(game.fen).id,
      'custom-games'
    );
    const bot = model.canBot() && game[side].kind === 'bot';
    return {
      localPlayers: custom?.localPlayers === true,
      bots: model.canBot(),
      difficulties: bot ? (custom?.bots.difficulties ?? []) : [],
      difficulty: game.difficulty[side],
      invitees: model.canInvite()
        ? model.members().map((person) => ({
            person,
            plainName: '',
            disabled: game.sides.some((other) => game[other].person === person),
          }))
        : null,
    };
  };
}

/** Every seat while the game is set up, each with its choices. */
export function useFrameSetupSeats(
  model: CustomGameScreenModel
): Accessor<readonly FrameSetupSeat[]> {
  const seat = useFrameSeat(model);
  const choices = useSeatChoices(model);
  const inviterName = usePersonName(() => model.current()?.creator ?? '');
  const setupSeat = (
    game: CustomGame,
    side: CustomGameSide
  ): FrameSetupSeat => {
    const holder = game[side];
    const mine = holder.person === model.myId();
    return {
      ...seat(game, side),
      host: holder.kind === 'person' && holder.person === game.creator,
      visiting: model.mySide() === side && !model.canConfigure(),
      own: model.mySide() === side,
      // A bot or a guest on this device is ready by itself, as the start
      // rule counts it; only a person gets ready.
      ready:
        holder.kind === 'bot' ||
        holder.kind === 'local' ||
        game.ready.includes(side),
      invitation:
        holder.kind === 'invitation'
          ? {
              mine,
              inviter: game.creator,
              inviterName: inviterName(),
              canAnswer: mine && model.canJoin(),
              canRevoke: model.canInvite(),
            }
          : null,
      canSit: holder.kind === 'open' && model.canJoin(),
      canLeave: holder.kind === 'person' && mine && model.canJoin(),
      choices: choices(game, side),
    };
  };
  return createMemo(() => {
    const game = model.current();
    return game === null ? [] : game.sides.map((side) => setupSeat(game, side));
  });
}
