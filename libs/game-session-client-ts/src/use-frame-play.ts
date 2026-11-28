import { gameSessionCancelRefusal } from '@libs/game-session-shared-ts/game-session-refusal';
import type { GameSession } from '@libs/game-session-shared-ts/game-session-state';
import {
  useGamePresentation,
  useTurnGames,
} from '@pkgs/turn-game-client-ts/turn-games-context';
import { useGameSideLabel } from '@pkgs/turn-game-client-ts/use-game-side-label';
import { type Accessor, createMemo } from 'solid-js';
import { FRAME_NO_PLAY } from './game-frame-empty';
import { frameSwatch } from './game-frame-look';
import {
  BOARD_TEST_ID,
  type FrameBoard,
  frameActionItems,
  gameSessionDrawToAnswer,
} from './game-frame-play';
import type {
  FrameMover,
  FrameNext,
  FramePlay,
  FrameRecord,
} from './game-frame-view-types';
import { useRefusalText } from './game-session-error';
import { frameViewerHeld, usePersonName } from './game-session-status';
import type { GameSessionReview } from './use-game-session-review';
import type { GameSessionScreenModel } from './use-game-session-screen';

/** The other participant, when they are a person who is away right now. */
function awayOpponent(model: GameSessionScreenModel): string | null {
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

const allPeople = (game: GameSession): boolean =>
  game.sides.every((side) => game[side].kind === 'person');

/**
 * The draw offers a participant is told of and may make or answer. A game
 * whose frame offers no draws (`drawOffers`) never shows the offer.
 */
function drawFacts(
  model: GameSessionScreenModel,
  game: GameSession,
  drawOffers: boolean
) {
  const offer = game.drawOfferedBy;
  const playing = model.mySide() !== null && model.canPlay();
  const declined = game.declinedOffers.includes(model.myId());
  const offerable = drawOffers && playing && allPeople(game) && offer === '';
  return {
    drawOffered: offer !== '',
    offerAgainLater: offerable && declined,
    canOfferDraw: offerable && !declined && !frameViewerHeld(model),
    heldOfferDraw: offerable && !declined && frameViewerHeld(model),
    canAnswerDraw: gameSessionDrawToAnswer(model),
  };
}

/** What a participant is told and may do while the game is set up or played. */
export function useFramePlay(
  model: GameSessionScreenModel,
  board: FrameBoard
): Accessor<FramePlay> {
  const away = createMemo(() =>
    model.sharedAvailable() ? awayOpponent(model) : null
  );
  const awayName = usePersonName(() => away() ?? '');
  const offerer = createMemo(() => {
    const by = model.current()?.drawOfferedBy ?? '';
    return by === '' || by === model.myId() ? null : by;
  });
  const offererName = usePersonName(() => offerer() ?? '');
  const presentation = useGamePresentation();
  return createMemo((): FramePlay => {
    const game = model.current();
    const actions = frameActionItems(
      board.session()?.actions() ?? [],
      BOARD_TEST_ID
    );
    if (game === null) return { ...FRAME_NO_PLAY, ...actions };
    const person = away();
    const twoSided = game.sides.length === 2;
    const unfinished =
      game.status === 'configuring' || game.status === 'active';
    const resigns =
      game.status === 'active' && model.mySide() !== null && model.canPlay();
    return {
      ...drawFacts(model, game, presentation(game.fen).frame.drawOffers),
      drawOfferer: ((by) =>
        by === null ? null : { person: by, plainName: offererName() })(
        offerer()
      ),
      away:
        person === null ? null : { person, plainName: awayName(), twoSided },
      canClaimWin: person !== null && model.canPlay() && twoSided,
      canResign: resigns && !frameViewerHeld(model),
      heldResign: resigns && frameViewerHeld(model),
      canCancel:
        unfinished &&
        model.canCancel() &&
        gameSessionCancelRefusal(game, model.myId()) === '',
      ...actions,
    };
  });
}

/** What comes next once the game is over. */
export function useFrameNext(
  model: GameSessionScreenModel
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
function useRecordMovers(review: GameSessionReview) {
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
  model: GameSessionScreenModel,
  review: GameSessionReview
): Accessor<FrameRecord | null> {
  const rules = useTurnGames();
  const refusal = useRefusalText();
  // By value: a move appended changes one label, not every row.
  const moves = createMemo(
    (): readonly string[] => review.game()?.moves.map((move) => move.san) ?? [],
    {
      equals: (a, b) =>
        a.length === b.length && a.every((label, index) => label === b[index]),
    }
  );
  const movers = useRecordMovers(review);
  const presentation = useGamePresentation();
  return createMemo(() => {
    if (model.current() === null) return null;
    return {
      moveHeading: presentation(review.fen()).moveHeading?.() ?? '',
      firstTurnSample: presentation(review.fen()).frame.firstTurnSample?.map(
        (sample) => ({ label: sample.label, swatch: frameSwatch(sample.look) })
      ),
      earlier: model.games().history.map((game) => game.id),
      selection: review.selection(),
      turns: rules.turnsForPosition(review.fen()) !== undefined,
      moves: moves(),
      ...movers(),
      displayedPly: review.displayedPly(),
      error: refusal(review.error()),
      history: model.openHistory !== undefined,
      outline: presentation(review.fen()).frame.outline?.(review.fen()) ?? [],
    };
  });
}

/** One public render snapshot, so automated observers never combine different turns. */
export function useFrameBoardState(
  model: GameSessionScreenModel,
  review: GameSessionReview,
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
