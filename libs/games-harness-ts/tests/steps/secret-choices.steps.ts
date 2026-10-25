/**
 * Secret choices in a custom game of more than two sides: one per side and
 * round, seen chosen by everyone and seen by its own person alone, none
 * taking effect before the last, a bot choosing its own, and none made
 * without a connection.
 */

import { expect } from 'bun:test';
import { customGameView } from '@libs/game-session-harness-ts/custom-game-probe';
import { recordedLine } from '@libs/game-session-harness-ts/played-rules';
import { restoreNetwork } from '@libs/harness-ts/actions';
import { Given, Then, When } from '@libs/harness-ts/define';
import { cutConnection } from '@libs/harness-ts/platform';
import { gameSides } from '@pkgs/turn-game-shared-ts/game-rules';
import { current, toldOf } from './custom-game-set-up-world';
import { before, gameOf } from './game-world';
import {
  followKnownLine,
  knownLine,
  lineState,
  roundAfterMoveBy,
  secretChoiceRound,
} from './known-line';
import {
  awaitingSecretChoicesAt,
  backOnline,
  FOUR_PEOPLE,
  makeOwnSecretChoice,
  makeSecretChoice,
  reachesNone,
  rememberedSecretChoice,
  rememberScreen,
  roundPly,
  SHOWN_WITHIN_MS,
  secretChoiceOf,
  seesChosen,
  seesOwnSecretChoice,
  seesSameSecretChoice,
  sideShown,
} from './secret-choices-world';

const SECOND_MS = 1_000;

Given(
  'Alice, Bob, Carol and Dave have a four-player custom game awaiting secret choices',
  async (w) =>
    awaitingSecretChoicesAt(w, secretChoiceRound(gameOf(w), knownLine(w), 1))
);
Given(
  'Alice, Bob, Carol and Dave have a four-player custom game in its second round of secret choices',
  async (w) => {
    const line = knownLine(w);
    w.memo.set('earlier-round', secretChoiceRound(gameOf(w), line, 1));
    await awaitingSecretChoicesAt(w, secretChoiceRound(gameOf(w), line, 2));
  }
);
// The round opens after the fourth side's move: Dave's move is the known line's.
Given(
  'Alice, Bob, Carol and Dave have a four-player custom game one move from its next round of secret choices',
  async (w) => {
    const line = knownLine(w);
    const fourth = gameSides(gameOf(w).shared.turnGame.rules)[3]!;
    const round = roundAfterMoveBy(gameOf(w), line, fourth);
    await followKnownLine(w, FOUR_PEOPLE, line, round - 1);
    expect((await current(w)).turn).toBe(fourth);
  }
);
Given(
  'Alice has a four-player custom game against three bots awaiting secret choices',
  async (w) => {
    const line = knownLine(w);
    const ply = secretChoiceRound(gameOf(w), line, 1);
    await followKnownLine(
      w,
      { second: 'bot', third: 'bot', fourth: 'bot' },
      line,
      ply
    );
    w.memo.set('secret-choices-round', ply);
    expect((await current(w)).awaiting).toContain(await sideShown(w, 'alice'));
  }
);
Given('{actor} has made his/her secret choice', async (w, actor: string) => {
  await makeOwnSecretChoice(w, actor);
  await seesChosen(w, actor, actor);
  await rememberScreen(w, actor);
});
Given(
  '{actor}, {actor} and {actor} have made their secret choices',
  async (w, first: string, second: string, third: string) => {
    for (const actor of [first, second, third]) {
      await makeOwnSecretChoice(w, actor);
      await seesChosen(w, actor, actor);
    }
  }
);
Given(
  '{actor} is back online after his/her offline secret choice was refused',
  async (w, actor: string) => {
    await cutConnection(w, actor);
    await makeOwnSecretChoice(w, actor);
    await toldOf(w, actor, 'connection needed');
    await backOnline(w, actor);
  }
);

When('{actor} makes his/her/a secret choice', async (w, actor: string) =>
  makeOwnSecretChoice(w, actor)
);
When('{actor} makes another secret choice', async (w, actor: string) =>
  makeSecretChoice(
    w,
    actor,
    await secretChoiceOf(w, actor, roundPly(w), 1),
    roundPly(w)
  )
);
When(
  '{actor} makes his/her secret choice for the earlier round of secret choices',
  async (w, actor: string) => {
    const earlier = Number(w.memo.get('earlier-round'));
    await makeSecretChoice(
      w,
      actor,
      await secretChoiceOf(w, actor, earlier),
      earlier
    );
  }
);

Then('{actor} sees his/her own secret choice', async (w, actor: string) =>
  seesOwnSecretChoice(w, actor)
);
Then("{actor}'s secret choice is unchanged", async (w, actor: string) =>
  seesSameSecretChoice(w, actor)
);
Then(
  '{actor}, {actor} and {actor} see {actor} has made his/her secret choice',
  async (w, ...[a, b, c, person]: [string, string, string, string]) => {
    for (const viewer of [a, b, c]) await seesChosen(w, viewer, person);
  }
);
Then(
  '{actor}, {actor}, {actor} and {actor} see {actor} has made his/her secret choice',
  async (w, ...people: [string, string, string, string, string]) => {
    const [person] = people.slice(-1);
    for (const viewer of people.slice(0, -1))
      await seesChosen(w, viewer, String(person));
  }
);
Then(
  "{actor}, {actor}, {actor} and {actor} cannot see {actor}'s secret choice",
  async (w, ...people: [string, string, string, string, string]) => {
    const [person] = people.slice(-1);
    for (const viewer of people.slice(0, -1))
      await reachesNone(w, viewer, [rememberedSecretChoice(w, String(person))]);
  }
);
Then(
  "{actor} cannot see {actor}'s secret choice",
  async (w, viewer: string, person: string) =>
    reachesNone(w, viewer, [rememberedSecretChoice(w, person)])
);
Then(
  '{actor} does not see {actor} has made his/her secret choice until the connection comes back',
  async (w, viewer: string, person: string) => {
    const side = await sideShown(w, person);
    await w.s.advanceTime(5 * SECOND_MS);
    expect(
      (await w.s.read(customGameView, viewer)).current?.committed
    ).not.toContain(side);
    await w.s.apply(restoreNetwork);
    await seesChosen(w, viewer, person);
  }
);
Then(
  '{actor} is told he/she has already made his/her secret choice',
  async (w, actor: string) => toldOf(w, actor, 'already chosen')
);
Then(
  '{actor} is told that secret choice was for an earlier round of secret choices',
  async (w, actor: string) => toldOf(w, actor, 'board changed')
);
Then(
  '{actor} is told the custom game is not awaiting secret choices',
  async (w, actor: string) => toldOf(w, actor, 'nothing to choose now')
);
Then(
  "{actor} is told the custom game is awaiting {actor}'s secret choice",
  async (w, actor: string, awaited: string) => {
    await toldOf(w, actor, 'every side chooses first');
    expect((await current(w)).awaiting).toEqual([await sideShown(w, awaited)]);
  }
);
Then('nobody has made a secret choice', async (w) => {
  expect((await current(w)).committed).toEqual([]);
});
Then('the custom game is awaiting secret choices', async (w) => {
  const game = await current(w);
  expect(game.status).toBe('active');
  expect(game.awaiting).toEqual(game.sides);
});
// One round's secret choices become one move of the custom game, together.
Then('every secret choice of the round takes effect at once', async (w) => {
  const earlier = before(w).current?.moves.length ?? 0;
  const game = await w.s.until((s) => customGameView(s, 'alice'), {
    pred: (shown) => shown.current?.moves.length === earlier + 1,
    maxMs: SHOWN_WITHIN_MS,
  });
  expect(game.current?.moves).toHaveLength(earlier + 1);
  expect(game.current?.awaiting).toEqual([]);
  expect(game.current?.committed).toEqual([]);
});
Then('no secret choice has taken effect', async (w) => {
  const game = await current(w);
  expect(game.moves).toEqual(before(w).current?.moves ?? []);
  expect(game.awaiting).not.toEqual([]);
});
Then("the custom game goes on as the game's rules say", async (w) => {
  const game = await current(w);
  const line = knownLine(w).slice(0, game.moves.length);
  expect(game.status).toBe('active');
  expect(game.moves.map((move) => move.uci)).toEqual(
    recordedLine(gameOf(w), line)
  );
  expect(game.turn).toBe(lineState(gameOf(w), line).turn);
});
