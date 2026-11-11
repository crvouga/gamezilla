import { gameRecord } from '@libs/game-matchmaking-shared-ts/game-record';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import {
  bothHaveMoved,
  isFinished,
} from '@libs/game-matchmaking-shared-ts/game-state';
import {
  multiplayerPeople,
  multiplayerSideOf,
} from '@libs/game-matchmaking-shared-ts/multiplayer-roster';
import { useClipboard } from '@pkgs/device-client-ts/solid';
import {
  useGamePresentation,
  useTurnGames,
} from '@pkgs/turn-game-client-ts/turn-games-context';
import { type Accessor, createMemo } from 'solid-js';
import type {
  MultiplayerConfirm,
  MultiplayerGameCommands,
  MultiplayerGameView,
  MultiplayerMovesShown,
  MultiplayerOffer,
  MultiplayerRecordView,
} from './multiplayer-game-view';
import type { MultiplayerControlsModel } from './use-multiplayer-controls';
import type { MultiplayerData } from './use-multiplayer-data';
import type { OwnBoard } from './use-own-board';
import { useShownName } from './use-shown-name';

/**
 * What a game that is over with a result offers to keep: its game record,
 * naming the people as the person copying sees them now, and its final
 * position. An unfinished or aborted game offers neither.
 */
function useGameRecord(
  game: Accessor<MultiplayerGame | null>
): Accessor<MultiplayerRecordView | null> {
  const rules = useTurnGames();
  const white = useShownName(() => game()?.white_id ?? '');
  const black = useShownName(() => game()?.black_id ?? '');
  const red = useShownName(() => game()?.red_id ?? '');
  const blue = useShownName(() => game()?.blue_id ?? '');
  return createMemo(() => {
    const current = game();
    if (current === null) return null;
    const record = gameRecord(
      current,
      { white: white(), black: black(), red: red(), blue: blue() },
      rules
    );
    return record === null ? null : { record, finalPosition: current.fen };
  });
}

/** An offer made by another person of the game waits for this one. */
function offeredTo(
  game: MultiplayerGame,
  myId: string,
  by: string | null
): boolean {
  return Boolean(by && by !== myId && multiplayerPeople(game).includes(by));
}

function offerOf(open: boolean, offered: boolean): MultiplayerOffer {
  if (!open) return 'none';
  return offered ? 'answer' : 'offer';
}

/** The moves and the position this device shows; `null` for a game without turns. */
function movesOf(view: OwnBoard): MultiplayerMovesShown {
  const earlier = view.earlier();
  return {
    moves: view.moves(),
    shownPly: view.shownPly(),
    reviewing: earlier === null ? null : { after: earlier.move?.name ?? null },
  };
}

/**
 * The matched game as `MultiplayerScreenView` shows it: which commands its
 * state allows this person, its moves and what it offers to keep. `null`
 * without a game.
 */
export function useMultiplayerGameView(
  data: MultiplayerData,
  view: OwnBoard
): Accessor<MultiplayerGameView | null> {
  const rules = useTurnGames();
  const presentation = useGamePresentation();
  const record = useGameRecord(data.game);
  return createMemo((): MultiplayerGameView | null => {
    const game = data.game();
    if (game === null) return null;
    const hasTurns = rules.turnsForPosition(game.fen) !== undefined;
    const playing = multiplayerSideOf(game, data.myId()) !== null;
    const ongoing = playing && game.outcome === 'ongoing';
    const over = playing && game.outcome !== 'ongoing';
    const started = hasTurns
      ? bothHaveMoved(game)
      : data.execution()?.started === true;
    const leave: MultiplayerConfirm = started ? 'resign' : 'abort';
    return {
      players: multiplayerPeople(game).length,
      leave: ongoing ? leave : null,
      draw: offerOf(ongoing, offeredTo(game, data.myId(), game.draw_offer_by)),
      rematch: offerOf(
        over && isFinished(game.outcome),
        offeredTo(game, data.myId(), game.rematch_offer_by)
      ),
      newOpponent: over,
      flip:
        hasTurns && presentation(game.fen).canFlip
          ? { flipped: view.flipped() }
          : null,
      moves: hasTurns ? movesOf(view) : null,
      record: record(),
    };
  });
}

/** The matched game's commands, wired to matchmaking and this device's board. */
export function useMultiplayerGameCommands(
  controls: MultiplayerControlsModel,
  view: OwnBoard,
  ask: (kind: MultiplayerConfirm) => void
): MultiplayerGameCommands {
  const clipboard = useClipboard();
  return {
    offerDraw: controls.offerDraw,
    acceptDraw: controls.acceptDraw,
    declineDraw: controls.declineDraw,
    offerRematch: controls.offerRematch,
    acceptRematch: controls.acceptRematch,
    declineRematch: controls.declineRematch,
    newOpponent: controls.newOpponent,
    ask,
    flip: view.flip,
    chooseMove: view.chooseMove,
    stepBack: view.stepBack,
    stepForward: view.stepForward,
    goToStart: view.goToStart,
    returnToCurrent: view.returnToCurrent,
    copy: (text) => clipboard.writeText(text),
  };
}
