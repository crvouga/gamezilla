import { copyShownMultiplayerText } from '@libs/game-matchmaking-harness-ts/multiplayer-game-record';
import { reviewMultiplayerMoves } from '@libs/game-matchmaking-harness-ts/multiplayer-review';
import { openFindingAnOpponent } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import type { QuintValue } from '@pkgs/quint-shared-ts/itf';
import { variant } from '@pkgs/quint-shared-ts/itf';
import type { Picks } from '@pkgs/quint-shared-ts/registry';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import rematchTrace from './fixtures/own-board-rematch-known-deal.itf.json';
import type { OwnBoardScreen } from './matched-game-own-board-world';
import {
  acceptOwnBoardRematch,
  OWN_BOARD_PEOPLE,
  playOwnBoardMove,
  prepareOwnBoardModel,
  readOwnBoardScreens,
  sendOwnBoardCommand,
} from './matched-game-own-board-world';
import { modelGameOf } from './model-game';

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
  const side = outcome === 'white' ? 'first' : 'second';
  const winner = [...screens].find(([, screen]) => screen.playSide === side);
  return outcome === 'white' || outcome === 'black'
    ? variant('WonPlay', winner?.[0] ?? 'nobody')
    : variant('NotTheSameForEveryone');
}

async function observeOwnBoard(
  w: QuintHarnessWorld
): Promise<Record<string, QuintValue>> {
  const screens = await readOwnBoardScreens(w);
  const each = (read: (screen: OwnBoardScreen) => QuintValue) =>
    new Map<QuintValue, QuintValue>(
      OWN_BOARD_PEOPLE.map((name) => [name, read(screens.get(name)!)])
    );
  return {
    moveCount: shownToEveryone(screens, (screen) => screen.moveCount),
    playOutcome: outcomeShown(screens),
    playSide: each((screen) => screen.playSide),
    earlierPosition: each((screen) => screen.earlierPosition),
    nearestSide: each((screen) => screen.nearestSide),
    gameRecordOffered: shownToEveryone(
      screens,
      (screen) => screen.gameRecordOffered
    ),
  };
}

/** The person reviews their own board on their screen, opened first. */
function reviewing(step: 'start' | 'back' | 'forward' | 'current' | 'chosen') {
  return async (w: QuintHarnessWorld, picks: Picks) => {
    const actor = person(picks);
    await w.s.apply(openFindingAnOpponent, actor, modelGameOf(w).shared.id);
    await w.s.apply(
      reviewMultiplayerMoves,
      actor,
      step === 'chosen' ? Number(picks['position']) : step
    );
  };
}

function copying(what: 'game record' | 'final position') {
  return async (w: QuintHarnessWorld, picks: Picks) => {
    const actor = person(picks);
    await w.s.apply(openFindingAnOpponent, actor, modelGameOf(w).shared.id);
    await w.s.apply(copyShownMultiplayerText, actor, what);
  };
}

bindQuintModel<QuintHarnessWorld>({
  model: 'matched-game-own-board',
  // Copying needs a matched game that is over with a result: two accepted
  // moves, then a resignation, among eleven actions three people may take.
  traces: 48,
  maxSteps: 48,
  timeoutMs: 300_000,
  regressions: [
    {
      // regression: own-board-rematch-known-deal
      id: 'own-board-rematch-known-deal',
      title: 'A rematch starts from the known deal before its first move',
      seed: '0x67932',
      itf: rematchTrace,
    },
  ],
  actions: {
    init: prepareOwnBoardModel,
    playMove: (w, picks) => playOwnBoardMove(w, person(picks)),
    resignGame: (w, picks) =>
      sendOwnBoardCommand(w, person(picks), 'resignMultiplayer'),
    abortGame: (w, picks) =>
      sendOwnBoardCommand(w, person(picks), 'abortMultiplayer'),
    acceptRematch: (w, picks) => acceptOwnBoardRematch(w, person(picks)),
    chooseEarlierPosition: reviewing('chosen'),
    stepBackOneMove: reviewing('back'),
    stepForwardOneMove: reviewing('forward'),
    goToStart: reviewing('start'),
    returnToCurrentPosition: reviewing('current'),
    copyGameRecord: copying('game record'),
    copyFinalPosition: copying('final position'),
  },
  observe: observeOwnBoard,
});
