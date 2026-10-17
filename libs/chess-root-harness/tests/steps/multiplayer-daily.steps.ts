import {
  acceptedMoves,
  searchFor,
} from '@libs/game-matchmaking-harness/matched-game-world';
import { passMultiplayerDays } from '@libs/game-matchmaking-harness/multiplayer-time';
import { dailyTimeControlId } from '@libs/game-matchmaking-shared/time-control';
import { Given, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { multiplayerPeople } from './multiplayer-people';
import { givenBegunGame, givenGame } from './multiplayer-world';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

// ------------------------------------------------------------ daily games

Given(
  '{actor} is White and {actor} is Black in a new daily game at {int} day(s) per move',
  (w, white: Actor, black: Actor, days: number) =>
    givenGame(w, white, black, dailyTimeControlId(days))
);
Given(
  '{actor} is White and {actor} is Black in a daily game at {int} day(s) per move after e4 and e5',
  (w, white: Actor, black: Actor, days: number) =>
    givenBegunGame(w, white, black, dailyTimeControlId(days))
);
Given(
  '{actor} is White and {actor} is Black in a daily game at {int} day(s) per move after f3, e5 and g4',
  async (w, white: Actor, black: Actor, days: number) => {
    await givenGame(w, white, black, dailyTimeControlId(days));
    await acceptedMoves(w, ['f2f3', 'e7e5', 'g2g4']);
  }
);
Given(
  '{actor} and {actor} are looking for {int} day(s) per move chess opponents',
  async (w, first: Actor, second: Actor, days: number) => {
    await multiplayerPeople(w, [first, second]);
    await searchFor(w, first, dailyTimeControlId(days));
    await w.s.advanceTime(1);
    await searchFor(w, second, dailyTimeControlId(days));
  }
);

// --------------------------------------------------------- daily clock

function passing(w: HarnessWorld, ms: number) {
  return w.s.apply(passMultiplayerDays, ms);
}

When('{int} day(s) pass(es) in multiplayer chess', (w, days: number) =>
  passing(w, days * DAY_MS)
);
Given('{int} day(s) has/have passed in multiplayer chess', (w, days: number) =>
  passing(w, days * DAY_MS)
);
When('{int} hour(s) pass(es) in multiplayer chess', (w, hours: number) =>
  passing(w, hours * HOUR_MS)
);
