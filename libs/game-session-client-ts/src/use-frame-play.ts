import { customGameCancelRefusal } from '@libs/game-session-shared-ts/custom-game-refusal';
import type { CustomGame } from '@libs/game-session-shared-ts/custom-game-state';
import {
  useGamePresentation,
  useTurnGames,
} from '@pkgs/turn-game-client-ts/turn-games-context';
import { useGameSideLabel } from '@pkgs/turn-game-client-ts/use-game-side-label';
import { type Accessor, createMemo } from 'solid-js';
import { useRefusalText } from './custom-game-error';
import { usePersonName } from './custom-game-status';
import { FRAME_NO_PLAY } from './game-frame-empty';
import { frameSwatch } from './game-frame-look';
import {
  BOARD_TEST_ID,
  type FrameBoard,
  frameActionItems,
} from './game-frame-play';
import type {
  FrameMover,
  FrameNext,
  FramePlay,
  FrameRecord,
} from './game-frame-view-types';
import type { CustomGameReview } from './use-custom-game-review';
import type { CustomGameScreenModel } from './use-custom-game-screen';

/** The other participant, when they are a person who is away right now. */
function awayOpponent(model: CustomGameScreenModel): string | null {
  const game = model.current();
  const side = model.mySide();
  if (game === null || side === null) return null;
  const other = game.sides
    .filter((candidate) => candidate !== side)
    .map((candidate) => game[candidate])
    .find(
      (participant) =>
        participant.kind === 'person' &&
        model.awaySince(participant.person) !== null
    );
  return other?.person ?? null;
}

const allPeople = (game: CustomGame): boolean =>
  game.sides.every((side) => game[side].kind === 'person');

/** The draw offers a participant is told of and may make or answer. */
function drawFacts(model: CustomGameScreenModel, game: CustomGame) {
  const offer = game.drawOfferedBy;
  const playing = model.mySide() !== null && model.canPlay();
  const declined = game.declinedOffers.includes(model.myId());
  return {
    drawOffered: offer !== '',
    offerAgainLater: playing && allPeople(game) && offer === '' && declined,
    canOfferDraw: playing && allPeople(game) && offer === '' && !declined,
    canAnswerDraw:
      playing &&
      offer !== '' &&
      offer !== model.myId() &&
      !game.drawAcceptedBy.includes(model.myId()),
  };
}

/** What a participant is told and may do while the game is set up or played. */
export function useFramePlay(
  model: CustomGameScreenModel,
  board: FrameBoard
): Accessor<FramePlay> {
  const away = createMemo(() =>
    model.sharedAvailable() ? awayOpponent(model) : null
  );
  const awayName = usePersonName(() => away() ?? '');
  return createMemo((): FramePlay => {
    const game = model.current();
    const boardActions = frameActionItems(
      board.session()?.actions() ?? [],
      BOARD_TEST_ID
    );
    if (game === null) return { ...FRAME_NO_PLAY, boardActions };
    const person = away();
    const twoSided = game.sides.length === 2;
    const unfinished =
      game.status === 'configuring' || game.status === 'active';
    return {
      ...drawFacts(model, game),
      away:
        person === null ? null : { person, plainName: awayName(), twoSided },
      canClaimWin: person !== null && model.canPlay() && twoSided,
      canResign:
        game.status === 'active' && model.mySide() !== null && model.canPlay(),
      canCancel:
        unfinished &&
        model.canCancel() &&
        customGameCancelRefusal(game, model.myId()) === '',
      boardActions,
    };
  });
}

/** What comes next once the game is over. */
export function useFrameNext(
  model: CustomGameScreenModel
): Accessor<FrameNext> {
  const rules = useTurnGames();
  return createMemo(() => {
    const game = model.current();
    return {
      plays: model.mySide() !== null || model.canCreate(),
      canCreate: model.canCreate(),
      reviewable:
        game !== null &&
        game.moves.length > 0 &&
        rules.turnsForPosition(game.fen) !== undefined,
    };
  });
}

/**
 * Who made each move of the shown game. Seats in rotation move in seat
 * order from the first; a game that names the next side itself (a trick's
 * winner leads) or deals hands names no mover, so its record numbers every
 * move alone.
 */
function useRecordMovers(review: CustomGameReview) {
  const rules = useTurnGames();
  const presentation = useGamePresentation();
  const sideLabel = useGameSideLabel();
  return createMemo((): { perTurn: number; movers: readonly FrameMover[] } => {
    const game = review.game();
    const turns = game === null ? undefined : rules.turnsForPosition(game.fen);
    if (
      game === null ||
      turns === undefined ||
      turns.turnOrder === 'rules' ||
      turns.hands !== undefined
    )
      return { perTurn: 1, movers: [] };
    const seats = game.sides.map((side) => ({
      sideLabel: sideLabel(game.fen, side),
      swatch: frameSwatch(presentation(game.fen).frame.seats.look(side)),
    }));
    return {
      perTurn: seats.length,
      movers: game.moves.map((_, index) => seats[index % seats.length]!),
    };
  });
}

/** The game's record beside the board; `null` with no game. */
export function useFrameRecord(
  model: CustomGameScreenModel,
  review: CustomGameReview
): Accessor<FrameRecord | null> {
  const rules = useTurnGames();
  const refusal = useRefusalText();
  // By value: a move appended changes one label, not every row.
  const moves = createMemo(
    () => review.game()?.moves.map((move) => move.san) ?? [],
    [],
    {
      equals: (a, b) =>
        a.length === b.length && a.every((label, index) => label === b[index]),
    }
  );
  const movers = useRecordMovers(review);
  return createMemo(() => {
    if (model.current() === null) return null;
    return {
      earlier: model.games().history.map((game) => game.id),
      selection: review.selection(),
      turns: rules.turnsForPosition(review.fen()) !== undefined,
      moves: moves(),
      ...movers(),
      displayedPly: review.displayedPly(),
      error: refusal(review.error()),
      history: model.openHistory !== undefined,
    };
  });
}

/** One public render snapshot, so automated observers never combine different turns. */
export function useFrameBoardState(
  model: CustomGameScreenModel,
  review: CustomGameReview,
  board: FrameBoard
): Accessor<Readonly<Record<string, string>>> {
  return createMemo(() => {
    const current = model.current();
    const canMove = board.interactive();
    return {
      state: JSON.stringify({
        position: review.fen(),
        status: current?.status ?? '',
        turn: current?.turn ?? '',
        outcome: current?.outcome ?? '',
        ply: current?.moves.length ?? 0,
        canMove,
      }),
      fen: review.fen(),
      status: current?.status ?? '',
      turn: current?.turn ?? '',
      outcome: current?.outcome ?? '',
      ply: String(current?.moves.length ?? 0),
      canmove: String(canMove),
    };
  });
}
