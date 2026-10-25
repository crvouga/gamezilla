/**
 * Stand-ins in a custom game of more than two sides: after 60 seconds away
 * a disclosed stand-in plays the person's side, refusing their own moves and
 * secret choices, until they take their side back with a connection.
 */

import { expect } from 'bun:test';
import { passMultiplayerTime } from '@libs/game-matchmaking-harness-ts/multiplayer-time';
import { readCustomGameTime } from '@libs/game-session-harness-ts/custom-game-clocks';
import { customGameView } from '@libs/game-session-harness-ts/custom-game-probe';
import { CUSTOM_GAME_STAND_IN_MS } from '@libs/game-session-shared-ts/custom-game-stand-in';
import { partition } from '@libs/harness-ts/actions';
import { Given, Then, When } from '@libs/harness-ts/define';
import { cutConnection } from '@libs/harness-ts/platform';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import {
  choose,
  current,
  identityOf,
  toldOf,
} from './custom-game-set-up-world';
import { before, hostOf, rememberCustomGame, turnGameOf } from './game-world';
import { followKnownLine, knownLine, secretChoiceRound } from './known-line';
import {
  backOnline,
  FOUR_PEOPLE,
  makeOwnSecretChoice,
  rememberScreen,
  SHOWN_WITHIN_MS,
  seesChosen,
  sideShown,
} from './secret-choices-world';

const SECOND_MS = 1_000;

/**
 * `actor` loses the connection and stays away `ms` from when the host was
 * shown them going (a host's own absence counts at once).
 */
async function awayFor(
  w: HarnessWorld,
  actor: string,
  ms: number
): Promise<void> {
  const id = await identityOf(w, actor);
  await w.s.apply(partition, actor);
  if (actor === hostOf(w)) {
    await w.s.advanceTime(ms);
    return;
  }
  const seen = await w.s.until((s) => customGameView(s, hostOf(w)), {
    pred: (shown) => shown.away[id] !== undefined,
    maxMs: SHOWN_WITHIN_MS,
  });
  const since = seen.away[id];
  if (since === undefined) throw new Error(`${actor} was not seen leaving`);
  const elapsed = (await w.s.read(readCustomGameTime)) - since;
  await w.s.advanceTime(Math.max(0, ms - elapsed));
}

/** `actor` stays away until a stand-in plays their side. */
async function standInPlays(w: HarnessWorld, actor: string): Promise<void> {
  const side = await sideShown(w, actor);
  await awayFor(w, actor, CUSTOM_GAME_STAND_IN_MS);
  const seen = await w.s.until((s) => customGameView(s, hostOf(w)), {
    pred: (shown) => shown.current?.standIns.includes(side) === true,
    maxMs: SHOWN_WITHIN_MS,
  });
  expect(seen.current?.standIns).toContain(side);
}

/**
 * The custom game as it is once every stand-in has decided what it had to
 * decide right then (a secret choice, a move on its turn), remembered
 * before the act.
 */
async function standInsSettled(w: HarnessWorld): Promise<void> {
  await w.s.until((s) => customGameView(s, hostOf(w)), {
    pred: (shown) => {
      const game = shown.current;
      if (game === null) return false;
      const pending = game.awaiting.length > 0 ? game.awaiting : [game.turn];
      return !pending.some((side) => game.standIns.includes(side));
    },
    maxMs: SHOWN_WITHIN_MS,
  });
  await rememberCustomGame(w);
}

Given(
  'Alice has a four-player custom game against three bots with Alice to move',
  async (w) => {
    const line = knownLine(w);
    const round = secretChoiceRound(turnGameOf(w), line, 1);
    await followKnownLine(
      w,
      { second: 'bot', third: 'bot', fourth: 'bot' },
      line,
      round
    );
    await makeOwnSecretChoice(w, 'alice');
    const side = await sideShown(w, 'alice');
    const seen = await w.s.until((s) => customGameView(s, 'alice'), {
      pred: (shown) =>
        shown.current?.awaiting.length === 0 && shown.current.turn === side,
      maxMs: SHOWN_WITHIN_MS,
    });
    expect(seen.current?.turn).toBe(side);
    await rememberCustomGame(w);
  }
);
Given(
  "Alice, Bob, Carol and Dave have a four-player custom game one move from Carol's victory alone, with Dave to move",
  async (w) => {
    const line = turnGameOf(w).fixtures.sharedVictories?.alone;
    if (line === undefined)
      throw new Error(`${turnGameOf(w).label} names no victory alone`);
    await followKnownLine(w, FOUR_PEOPLE, line, line.length - 1);
    expect((await current(w)).turn).toBe(await sideShown(w, 'dave'));
  }
);
Given("a stand-in is playing {actor}'s side", async (w, actor: string) =>
  standInPlays(w, actor)
);
Given(
  "a stand-in is playing {actor}'s side and has made its secret choice",
  async (w, actor: string) => {
    await standInPlays(w, actor);
    await seesChosen(w, hostOf(w), actor);
  }
);
Given(
  '{actor} has been offline for {int} seconds',
  async (w, actor: string, seconds: number) => {
    await cutConnection(w, actor);
    await w.s.apply(passMultiplayerTime, seconds * SECOND_MS);
  }
);
Given('{actor} is back online', async (w, actor: string) => {
  await backOnline(w, actor);
  await standInsSettled(w);
  await rememberScreen(w, actor);
});
Given(
  '{actor} is back online and has taken back his/her side',
  async (w, actor: string) => {
    await backOnline(w, actor);
    await choose(w, actor, { operation: 'reclaim' });
    expect((await current(w)).standIns).not.toContain(
      await sideShown(w, actor)
    );
    await rememberCustomGame(w);
  }
);

When('a second passes', async (w) => {
  await w.s.apply(passMultiplayerTime, SECOND_MS);
});
When('{actor} takes back his/her side', async (w, actor: string) =>
  choose(w, actor, { operation: 'reclaim' })
);

Then(
  "{actor}, {actor} and {actor} see a stand-in playing {actor}'s side",
  async (w, ...[a, b, c, person]: [string, string, string, string]) => {
    const side = await sideShown(w, person);
    for (const viewer of [a, b, c]) {
      const seen = await w.s.until((s) => customGameView(s, viewer), {
        pred: (shown) => shown.current?.standIns.includes(side) === true,
        maxMs: SHOWN_WITHIN_MS,
      });
      expect(seen.current?.standIns).toContain(side);
    }
  }
);
Then(
  "{actor}'s stand-in makes a move for {actor}'s side",
  async (w, _standIn: string, person: string) => {
    const side = await sideShown(w, person);
    const earlier = before(w).current?.moves.length ?? 0;
    const seen = await w.s.until((s) => customGameView(s, 'alice'), {
      pred: (shown) => (shown.current?.moves.length ?? 0) > earlier,
      maxMs: SHOWN_WITHIN_MS,
    });
    expect(before(w).current?.turn).toBe(side);
    expect(seen.current?.moves).toHaveLength(earlier + 1);
    expect(seen.current?.turn).not.toBe(side);
    expect(seen.current?.standIns).toContain(side);
  }
);
Then("{actor}'s side still has no stand-in", async (w, actor: string) => {
  expect((await current(w)).standIns).not.toContain(await sideShown(w, actor));
});
Then("no stand-in plays {actor}'s side", async (w, actor: string) => {
  expect((await current(w)).standIns).not.toContain(await sideShown(w, actor));
});
Then("a stand-in still plays {actor}'s side", async (w, actor: string) => {
  expect((await current(w)).standIns).toContain(await sideShown(w, actor));
});
Then('{actor} still plays his/her own side', async (w, actor: string) => {
  const side = await sideShown(w, actor);
  const game = await current(w);
  expect(game[side].person).toBe(await identityOf(w, actor));
  expect(game.standIns).not.toContain(side);
});
Then(
  '{actor} is told a stand-in plays his/her side until he/she takes back his/her side',
  async (w, actor: string) => toldOf(w, actor, 'a stand-in plays your side')
);
// Taking back names no side: it is always the person's own, and none of
// theirs has a stand-in.
Then(
  '{actor} is told he/she is already playing his/her own side',
  async (w, actor: string) => toldOf(w, actor, 'no stand-in plays your side')
);
When("{actor}'s stand-in makes its move", async (w, actor: string) => {
  const side = await sideShown(w, actor);
  const earlier = before(w).current?.moves.length ?? 0;
  expect(before(w).current?.turn).toBe(side);
  await w.s.until((s) => customGameView(s, hostOf(w)), {
    pred: (shown) => (shown.current?.moves.length ?? 0) > earlier,
    maxMs: SHOWN_WITHIN_MS,
  });
});
Then(
  'the finished custom game shows {actor} on the fourth side',
  async (w, actor: string) => {
    const game = await current(w);
    const fourth = game.sides[3]!;
    expect(game.status).toBe('completed');
    expect(game[fourth]).toMatchObject({
      kind: 'person',
      person: await identityOf(w, actor),
    });
  }
);
