import {
  multiplayerClockSeconds,
  multiplayerPauseShown,
} from '@libs/chess-matchmaking-harness/multiplayer-availability';
import { gameRecordOffered } from '@libs/chess-matchmaking-harness/multiplayer-game-record';
import { multiplayerWatcherBoard } from '@libs/chess-matchmaking-harness/multiplayer-watchers';
import { multiplayerView } from '@libs/game-matchmaking-harness/multiplayer-reads';
import type { ProductHarness } from '@libs/harness/harness';
import {
  CLOCK_OBSERVERS,
  sharedClockGame,
  sharedClockSpeed,
} from './shared-clock-model';

/** Connected account readers observe the agreed game even when both phones are away. */
export async function observeSharedClockGame(s: ProductHarness) {
  const game = await sharedClockGame(s);
  const clocks = await multiplayerClockSeconds(s, CLOCK_OBSERVERS.alice);
  const speed = sharedClockSpeed(game.time_control);
  const ratedGames = new Map<string, number>();
  const canMove = new Map<string, boolean>();
  for (const person of ['alice', 'bob'] as const) {
    const view = await multiplayerView(s, CLOCK_OBSERVERS[person]);
    ratedGames.set(
      person,
      view.ratings.find((rating) => rating.speed === speed)?.games ?? 0
    );
    canMove.set(person, (await multiplayerWatcherBoard(s, person)).canMove);
  }
  return {
    speed,
    moves: game.revision,
    turn: game.fen.split(' ')[1] === 'w' ? 'alice' : 'bob',
    timeLeft: new Map([
      ['alice', clocks.white],
      ['bob', clocks.black],
    ]),
    clocksPaused: await multiplayerPauseShown(s, CLOCK_OBSERVERS.alice),
    winner:
      game.outcome === 'white'
        ? 'alice'
        : game.outcome === 'black'
          ? 'bob'
          : '',
    ratedGames,
    canMove,
    gameRecordOffered: (await gameRecordOffered(s, CLOCK_OBSERVERS.alice))
      .gameRecord,
  };
}
