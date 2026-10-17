/**
 * The rated matched game `specs/games/matched-game-clock-recovery.qnt`
 * keeps through an interruption of shared play, of the trace's game: Alice
 * and Bob after their first moves, each with a second device signed in to
 * their account that keeps reading the agreed game while their own device
 * is away.
 */

import {
  multiplayerClockSeconds,
  multiplayerPauseShown,
  SHARED_CLOCK_CONTROLS,
  setMultiplayerAvailability,
} from '@libs/game-matchmaking-harness/multiplayer-availability';
import {
  joinMultiplayerSpace,
  multiplayerBoardShown,
} from '@libs/game-matchmaking-harness/multiplayer-board';
import { givenMultiplayerClock } from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import { gameRecordOffered } from '@libs/game-matchmaking-harness/multiplayer-game-record';
import { multiplayerView } from '@libs/game-matchmaking-harness/multiplayer-reads';
import { openFindingAnOpponent } from '@libs/game-matchmaking-harness/opponent-seeking';
import {
  startingMs,
  timeControlOf,
} from '@libs/game-matchmaking-shared/time-control';
import { signInWithGoogleAsAccount } from '@libs/harness/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { modelClockChoice, productClockChoice } from './matched-game-clock';
import {
  changeSpacesMatch,
  prepareMatchedSpaces,
  SPACE_HOSTS,
  spacesMatch,
} from './matched-game-spaces-world';
import { modelGameOf } from './model-game';

/** Each person's second device, which reads the agreed game for them. */
export const CLOCK_OBSERVERS = {
  alice: 'alice-clock-reader',
  bob: 'bob-clock-reader',
} as const;

/** The matched game at the model's speed, after both first moves. */
export async function prepareSharedClockGame(
  w: QuintHarnessWorld,
  speed: string
) {
  const control = SHARED_CLOCK_CONTROLS[speed];
  if (control === undefined) throw new Error(`Unknown speed ${speed}`);
  await prepareMatchedSpaces(w, control);
  for (const person of SPACE_HOSTS) {
    const observer = CLOCK_OBSERVERS[person];
    await w.s.apply(signInWithGoogleAsAccount, observer, person);
    await w.s.apply(joinMultiplayerSpace, observer, person);
    await w.s.apply(openFindingAnOpponent, observer, modelGameOf(w).shared.id);
  }
  for (const person of SPACE_HOSTS) await changeSpacesMatch(w, person, 'move');
  const game = await spacesMatch(w);
  await w.s.apply(givenMultiplayerClock, 'alice', {
    gameId: game.id,
    side: 'white',
    ms: startingMs(productClockChoice(w, control)),
  });
}

/** Shared play stops, or becomes usable again, for everyone. */
export async function changeSharedClockAvailability(
  w: QuintHarnessWorld,
  available: boolean
) {
  await w.s.apply(
    setMultiplayerAvailability,
    'alice',
    (await spacesMatch(w)).id,
    available
  );
}

/** Connected account readers observe the agreed game even when both phones are away. */
export async function observeSharedClockGame(w: QuintHarnessWorld) {
  const game = (await w.quiet.read(multiplayerView, CLOCK_OBSERVERS.alice))
    .game;
  if (game === null) throw new Error('The shared clock observer has no game.');
  const clocks = await w.quiet.read(
    multiplayerClockSeconds,
    CLOCK_OBSERVERS.alice
  );
  const speed =
    timeControlOf(modelClockChoice(w, game.time_control))?.speed ?? 'unknown';
  const ratedGames = new Map<string, number>();
  const canMove = new Map<string, boolean>();
  for (const person of SPACE_HOSTS) {
    const view = await w.quiet.read(multiplayerView, CLOCK_OBSERVERS[person]);
    ratedGames.set(
      person,
      view.ratings.find(
        (rating) => rating.speed === timeControlOf(game.time_control)?.speed
      )?.games ?? 0
    );
    canMove.set(
      person,
      (await w.quiet.read(multiplayerBoardShown, person)).canMove
    );
  }
  return {
    speed,
    moves: game.revision,
    // The side to move by the board, whatever the result: the first side
    // (Alice) after an even number of moves, as turns alternate.
    turn: game.revision % 2 === 0 ? 'alice' : 'bob',
    timeLeft: new Map([
      ['alice', clocks.white],
      ['bob', clocks.black],
    ]),
    clocksPaused: await w.quiet.read(
      multiplayerPauseShown,
      CLOCK_OBSERVERS.alice
    ),
    winner:
      game.outcome === 'white'
        ? 'alice'
        : game.outcome === 'black'
          ? 'bob'
          : '',
    ratedGames,
    canMove,
    gameRecordOffered: (
      await w.quiet.read(gameRecordOffered, CLOCK_OBSERVERS.alice)
    ).gameRecord,
  };
}
