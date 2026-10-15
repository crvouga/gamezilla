import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import {
  SHARED_CLOCK_CONTROLS,
  setMultiplayerAvailability,
} from '@libs/chess-matchmaking-harness/multiplayer-availability';
import { sendMultiplayerCommand } from '@libs/chess-matchmaking-harness/multiplayer-commands';
import { givenMultiplayerClock } from '@libs/chess-matchmaking-harness/multiplayer-fixtures';
import { multiplayerView } from '@libs/chess-matchmaking-harness/multiplayer-reads';
import { joinMultiplayerSpace } from '@libs/chess-matchmaking-harness/multiplayer-watchers';
import {
  startingMs,
  timeControlOf,
} from '@libs/game-matchmaking-shared/time-control';
import { scenarioAction } from '@libs/harness/actor-ui';
import { signInWithGoogleAsAccount } from '@libs/harness/auth-actions';
import type { ProductHarness } from '@libs/harness/harness';
import { prepareMultiplayerSpaceModel } from './multiplayer-space-model';

export const CLOCK_OBSERVERS = {
  alice: 'alice-clock-reader',
  bob: 'bob-clock-reader',
} as const;
const OPENING = ['e2e4', 'e7e5', 'g1f3', 'b8c6'];

export async function sharedClockGame(s: ProductHarness) {
  const game = (await multiplayerView(s, CLOCK_OBSERVERS.alice)).game;
  if (game === null) throw new Error('The shared clock observer has no game.');
  return game;
}

export const prepareSharedClockGame = scenarioAction({
  name: 'prepareSharedClockGame',
  act: async (s, speed: string) => {
    const control = SHARED_CLOCK_CONTROLS[speed];
    if (control === undefined) throw new Error(`Unknown speed ${speed}`);
    await Promise.resolve(prepareMultiplayerSpaceModel.act(s, control));
    for (const person of ['alice', 'bob'] as const) {
      const observer = CLOCK_OBSERVERS[person];
      await Promise.resolve(signInWithGoogleAsAccount.act(s, observer, person));
      await Promise.resolve(joinMultiplayerSpace.act(s, observer, person));
      await Promise.resolve(openMultiplayerChess.act(s, observer));
    }
    for (const person of ['alice', 'bob'])
      await Promise.resolve(playSharedClockMove.act(s, person));
    const game = await sharedClockGame(s);
    await Promise.resolve(
      givenMultiplayerClock.act(s, 'alice', {
        gameId: game.id,
        side: 'white',
        ms: startingMs(control),
      })
    );
    await s.session.waitForIdle();
  },
});

async function command(
  s: ProductHarness,
  person: string,
  kind: 'move' | 'resign'
) {
  const game = await sharedClockGame(s);
  await Promise.resolve(
    sendMultiplayerCommand.act(s, person, {
      name: kind === 'move' ? 'playMultiplayerMove' : 'resignMultiplayer',
      args: {
        gameId: game.id,
        requestId: s.session.ports.createId(),
        revision: game.revision,
        uci: OPENING[game.revision] ?? 'a1a1',
      },
    })
  );
}

export const playSharedClockMove = scenarioAction({
  name: 'playSharedClockMove',
  act: (s, person: string) => command(s, person, 'move'),
});
export const resignSharedClockGame = scenarioAction({
  name: 'resignSharedClockGame',
  act: (s, person: string) => command(s, person, 'resign'),
});
export const changeSharedClockAvailability = scenarioAction({
  name: 'changeSharedClockAvailability',
  act: async (s, available: boolean) => {
    await Promise.resolve(
      setMultiplayerAvailability.act(
        s,
        'alice',
        (await sharedClockGame(s)).id,
        available
      )
    );
  },
});

export const sharedClockSpeed = (control: string | null): string =>
  timeControlOf(control)?.speed ?? 'unknown';
