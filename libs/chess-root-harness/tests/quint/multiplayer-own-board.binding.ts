import {
  copyFinalPosition,
  copyGameRecord,
} from '@libs/chess-matchmaking-harness/multiplayer-game-record';
import {
  chooseMultiplayerMove,
  flipMultiplayerBoard,
  goToMultiplayerStart,
  returnToCurrentPosition,
  stepMultiplayerMoves,
} from '@libs/chess-matchmaking-harness/multiplayer-own-board';
import type { OwnBoardScreen } from '@libs/chess-root-harness/multiplayer-own-board-model';
import {
  acceptOwnBoardRematch,
  OWN_BOARD_PEOPLE,
  playOwnBoardMove,
  prepareOwnBoardModel,
  readOwnBoardScreens,
  sendOwnBoardCommand,
} from '@libs/chess-root-harness/multiplayer-own-board-model';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import type { QuintValue } from '@pkgs/quint-shared/itf';
import { variant } from '@pkgs/quint-shared/itf';
import type { Picks } from '@pkgs/quint-shared/registry';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

const person = (picks: Picks): string => String(picks['person']);

/** What everyone's screen shows alike; a screen that differs is named. */
function shownToEveryone<T>(
  screens: ReadonlyMap<string, OwnBoardScreen>,
  read: (screen: OwnBoardScreen) => T
): T | 'not the same for everyone' {
  const shown = [...screens.values()].map(read);
  return shown.every((value) => value === shown[0]) && shown[0] !== undefined
    ? shown[0]
    : 'not the same for everyone';
}

function outcomeShown(screens: ReadonlyMap<string, OwnBoardScreen>) {
  const outcome = shownToEveryone(screens, (screen) => screen.outcome);
  if (outcome === 'ongoing') return variant('OngoingPlay');
  if (outcome === 'draw') return variant('DrawnPlay');
  if (outcome === 'aborted') return variant('AbortedPlay');
  const side = outcome === 'white' ? 'White' : 'Black';
  const winner = [...screens].find(([, screen]) => screen.playSide === side);
  return outcome === 'white' || outcome === 'black'
    ? variant('WonPlay', winner?.[0] ?? 'nobody')
    : variant('NotTheSameForEveryone');
}

async function observeOwnBoard(
  w: QuintHarnessWorld
): Promise<Record<string, QuintValue>> {
  const screens = await w.quiet.read(readOwnBoardScreens);
  const each = (read: (screen: OwnBoardScreen) => QuintValue) =>
    new Map<QuintValue, QuintValue>(
      OWN_BOARD_PEOPLE.map((name) => [name, read(screens.get(name)!)])
    );
  return {
    moveCount: shownToEveryone(screens, (screen) => screen.moveCount),
    playOutcome: outcomeShown(screens),
    playSide: each((screen) => screen.playSide),
    earlierPosition: each((screen) => screen.earlierPosition),
    boardFacing: each((screen) => screen.boardFacing),
    gameRecordOffered: shownToEveryone(
      screens,
      (screen) => screen.gameRecordOffered
    ),
  };
}

bindQuintModel<QuintHarnessWorld>({
  model: 'multiplayer-own-board',
  // Copying needs a game that is over with a result: two accepted moves,
  // then a resignation, among twelve actions three people may take.
  traces: 48,
  maxSteps: 48,
  timeoutMs: 300_000,
  actions: {
    init: (w) => w.s.apply(prepareOwnBoardModel),
    playMove: (w, picks) => w.s.apply(playOwnBoardMove, person(picks)),
    resignPlay: (w, picks) =>
      w.s.apply(sendOwnBoardCommand, person(picks), 'resignMultiplayer'),
    abortPlay: (w, picks) =>
      w.s.apply(sendOwnBoardCommand, person(picks), 'abortMultiplayer'),
    acceptRematch: (w, picks) =>
      w.s.apply(acceptOwnBoardRematch, person(picks)),
    chooseEarlierPosition: (w, picks) =>
      w.s.apply(
        chooseMultiplayerMove,
        person(picks),
        Number(picks['position'])
      ),
    stepBackOneMove: (w, picks) =>
      w.s.apply(stepMultiplayerMoves, person(picks), 'back'),
    stepForwardOneMove: (w, picks) =>
      w.s.apply(stepMultiplayerMoves, person(picks), 'forward'),
    goToStart: (w, picks) => w.s.apply(goToMultiplayerStart, person(picks)),
    returnToCurrentPosition: (w, picks) =>
      w.s.apply(returnToCurrentPosition, person(picks)),
    flipBoard: (w, picks) => w.s.apply(flipMultiplayerBoard, person(picks)),
    copyGameRecord: (w, picks) => w.s.apply(copyGameRecord, person(picks)),
    copyFinalPosition: (w, picks) =>
      w.s.apply(copyFinalPosition, person(picks)),
  },
  observe: observeOwnBoard,
});
