import { expect, test } from 'bun:test';
import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import {
  ChangeCustomGame,
  PlayCustomGameBot,
} from '@libs/game-session-shared-ts/custom-game-commands';
import { soloCustomGame } from '@libs/game-session-shared-ts/custom-game-local';
import {
  CustomGameSetupChosen,
  CustomGameSetupsAttr,
  ownCustomGameSetup,
} from '@libs/game-session-shared-ts/custom-game-setup';
import {
  type CustomGame,
  CustomGamesAttr,
} from '@libs/game-session-shared-ts/custom-game-state';
import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import { GamesRoomAttr } from '@libs/spaces-shared-ts/games';
import { SpaceMembersRoomAttr } from '@libs/spaces-shared-ts/space-members-messages';
import {
  createSpaceModule,
  type SpaceModule,
} from '@libs/spaces-shared-ts/space-module';
import type { Message } from '@pkgs/message-shared-ts/message';
import { ROOM_SCHEDULER_IDENTITY } from '@pkgs/room-root-shared-ts/builtin';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared-ts/types';
import { assertRoomModuleName } from '@pkgs/room-root-shared-ts/types';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { bots as raceBots, rules as raceRules } from './reference-game';
import { secretPickBots, secretPickRules } from './secret-pick';

const secretPick = defineGame({
  rules: secretPickRules,
  capabilities: { 'custom-games': { bots: secretPickBots } },
  turnAutomation: {
    choose: () => null,
    perform: async () => {},
    arrange: async () => {},
  },
});
const race = defineGame({
  rules: raceRules,
  capabilities: { 'custom-games': { bots: raceBots } },
  turnAutomation: { choose: () => null, perform: async () => {} },
});

function spaceModule(authority: boolean): SpaceModule {
  return createSpaceModule(
    assertRoomModuleName('secret-room'),
    [secretPick, race],
    {
      now: () => 0,
      random: () => 0.5,
      authority,
    }
  );
}
const ROOM = spaceModule(true);
const DEVICE = spaceModule(false);

function space(game: string): RoomState {
  return {
    ...ROOM.initialState(),
    ...GamesRoomAttr.selected(game),
    ...SpaceMembersRoomAttr.seats({
      alice: { joinedAt: '2026-10-15' },
      bob: { joinedAt: '2026-10-15' },
    }),
  };
}

let commands = 0;
function command(state: RoomState, input: CustomGameInput): Message {
  const game = CustomGamesAttr.from(state).current;
  return ChangeCustomGame({
    ...input,
    gameId: game?.id ?? null,
    revision: game?.revision ?? 0,
  } as Parameters<typeof ChangeCustomGame>[0]);
}

function handle(
  module: SpaceModule,
  state: RoomState,
  as: string,
  payload: Message
): HandleResult {
  commands += 1;
  return module.handle(state, { id: `c${commands}`, ts: 1000, payload }, as);
}

/** The room decides and commits `input` by `as`, failing on a refusal. */
function decide(
  state: RoomState,
  as: string,
  input: CustomGameInput
): RoomState {
  const result = handle(ROOM, state, as, command(state, input));
  if (!result.ok)
    throw new Error(`${as} ${input.operation}: ${reason(result)}`);
  return result.events.reduce((s, e) => ROOM.reduce(s, e), state);
}

function current(state: RoomState): CustomGame {
  const game = CustomGamesAttr.from(state).current;
  if (game === null) throw new Error('no custom game');
  return game;
}

function reason(result: HandleResult): string {
  return result.ok ? '' : 'reason' in result.error ? result.error.reason : '';
}

/** Alice on the first side and Bob on the second, neither ready. */
function twoPeople(): RoomState {
  const created = decide(space('secret-pick'), 'alice', {
    operation: 'create',
  });
  return decide(created, 'bob', { operation: 'claim', side: 'black' });
}

function underWay(): RoomState {
  let state = decide(twoPeople(), 'alice', { operation: 'ready', setup: 'n3' });
  state = decide(state, 'bob', { operation: 'ready', setup: 'n7' });
  return decide(state, 'alice', { operation: 'start' });
}

test('a setup travels with readiness and is read by its person alone', () => {
  const state = twoPeople();
  const result = handle(
    ROOM,
    state,
    'alice',
    command(state, { operation: 'ready', setup: 'n3' })
  );
  if (!result.ok) throw new Error('refused');
  const [changed, chosen] = result.events;
  expect(CustomGameSetupChosen.is(chosen!)).toBe(true);
  expect(ROOM.audience?.(chosen!)).toEqual(['alice']);
  expect(ROOM.audience?.(changed!)).toBeNull();
  expect(JSON.stringify(changed)).not.toContain('n3');
  const after = result.events.reduce((s, e) => ROOM.reduce(s, e), state);
  expect(current(after).ready).toEqual(['white']);
  expect(ownCustomGameSetup(after, current(after), 'alice')).toBe('n3');
});

test('readiness needs one complete setup, and a ready setup cannot change', () => {
  const state = twoPeople();
  const ready = (input: CustomGameInput, s = state) =>
    reason(handle(ROOM, s, 'alice', command(s, input)));
  expect(ready({ operation: 'ready' })).toBe('choose a setup first');
  expect(ready({ operation: 'ready', setup: 'n0' })).toBe(
    'the setup is not complete'
  );
  const readied = decide(state, 'alice', { operation: 'ready', setup: 'n3' });
  expect(ready({ operation: 'ready', setup: 'n4' }, readied)).toBe(
    'withdraw readiness to change the setup'
  );
  const withdrawn = decide(readied, 'alice', { operation: 'unready' });
  const changed = decide(withdrawn, 'alice', {
    operation: 'ready',
    setup: 'n4',
  });
  expect(ownCustomGameSetup(changed, current(changed), 'alice')).toBe('n4');
});

// regression: custom-game-private-setup-ready-again-refused
test('becoming ready again with the confirmed setup changes nothing and is not refused', () => {
  const readied = decide(twoPeople(), 'alice', {
    operation: 'ready',
    setup: 'n3',
  });
  for (const input of [
    { operation: 'ready', setup: 'n3' },
    { operation: 'ready' },
  ] as const) {
    for (const module of [ROOM, DEVICE]) {
      const result = handle(module, readied, 'alice', command(readied, input));
      expect(reason(result)).toBe('');
    }
    const again = decide(readied, 'alice', input);
    expect(current(again).ready).toEqual(['white']);
    expect(ownCustomGameSetup(again, current(again), 'alice')).toBe('n3');
  }
});

test('a game without private setups refuses a setup', () => {
  const created = decide(space('counting-race'), 'alice', {
    operation: 'create',
  });
  const result = handle(
    ROOM,
    created,
    'alice',
    command(created, { operation: 'ready', setup: 'n3' })
  );
  expect(reason(result)).toBe('the game has no setup');
});

test("a device predicts nothing of a move's outcome; the room resolves it with both setups", () => {
  const state = underWay();
  const move = command(state, { operation: 'move', uci: 'g7', ply: 0 });
  expect(handle(DEVICE, state, 'alice', move)).toMatchObject({
    ok: true,
    events: [],
  });
  const decided = handle(ROOM, state, 'alice', move);
  if (!decided.ok) throw new Error('refused');
  const after = decided.events.reduce((s, e) => ROOM.reduce(s, e), state);
  expect(current(after).moves).toEqual([{ uci: 'g7:found', san: '7 found' }]);
  expect(current(after).outcome).toBe('white wins by found');
});

test('a device refuses a move the public position already rules out', () => {
  const state = underWay();
  const repeated = command(state, { operation: 'move', uci: 'g10', ply: 0 });
  expect(reason(handle(DEVICE, state, 'alice', repeated))).toBe(
    'move is illegal'
  );
  const forged = command(state, { operation: 'move', uci: 'g7:found', ply: 0 });
  expect(reason(handle(ROOM, state, 'alice', forged))).toBe('move is illegal');
});

test("the room draws a bot's setup as the game starts, read by nobody; a device draws none", () => {
  let state = decide(space('secret-pick'), 'alice', { operation: 'create' });
  state = decide(state, 'alice', { operation: 'bot', side: 'black' });
  state = decide(state, 'alice', { operation: 'ready', setup: 'n3' });
  const start = command(state, { operation: 'start' });
  const predicted = handle(DEVICE, state, 'alice', start);
  if (!predicted.ok) throw new Error('refused');
  expect(predicted.events.some((e) => CustomGameSetupChosen.is(e))).toBe(false);
  const decided = handle(ROOM, state, 'alice', start);
  if (!decided.ok) throw new Error('refused');
  const bot = decided.events.find((e) => CustomGameSetupChosen.is(e));
  expect(bot === undefined ? null : ROOM.audience?.(bot)).toEqual([]);
  const after = decided.events.reduce((s, e) => ROOM.reduce(s, e), state);
  expect(CustomGameSetupsAttr.from(after)[current(after).id]).toEqual({
    white: 'n3',
    black: 'n5',
  });
});

test("a bot proposes from the public position and the room resolves it against the person's setup", () => {
  let state = decide(space('secret-pick'), 'alice', { operation: 'create' });
  state = decide(state, 'alice', { operation: 'swap' });
  state = decide(state, 'alice', { operation: 'bot', side: 'white' });
  state = decide(state, 'alice', { operation: 'ready', setup: 'n5' });
  state = decide(state, 'alice', { operation: 'start' });
  const game = current(state);
  const wake = handle(
    ROOM,
    state,
    ROOM_SCHEDULER_IDENTITY,
    PlayCustomGameBot({ gameId: game.id, ply: 0, side: 'white' })
  );
  if (!wake.ok) throw new Error('refused');
  const after = wake.events.reduce((s, e) => ROOM.reduce(s, e), state);
  // The bot guesses without seeing Alice's 5; the room answers the guess.
  const [move, ...rest] = current(after).moves;
  const guess = Number(move?.uci.match(/^g(\d)/)?.[1]);
  const answer = guess < 5 ? 'higher' : guess > 5 ? 'lower' : 'found';
  expect(rest).toEqual([]);
  expect(move).toEqual({
    uci: `g${guess}:${answer}`,
    san: `${guess} ${answer}`,
  });
});

test('a custom game with private setups is never played on the device alone', () => {
  const rules = createTurnGames([secretPick.turnGame, race.turnGame]);
  let state = decide(space('secret-pick'), 'alice', { operation: 'create' });
  state = decide(state, 'alice', { operation: 'bot', side: 'black' });
  expect(soloCustomGame(current(state), rules)).toBe(false);
  let open = decide(space('counting-race'), 'alice', { operation: 'create' });
  open = decide(open, 'alice', { operation: 'bot', side: 'black' });
  expect(soloCustomGame(current(open), rules)).toBe(true);
});

test("a rematch starts with no setup of the finished game's", () => {
  const finished = (() => {
    const state = underWay();
    return decide(state, 'alice', { operation: 'move', uci: 'g7', ply: 0 });
  })();
  const rematch = decide(finished, 'alice', { operation: 'rematch' });
  const next = current(rematch);
  expect(next.id).not.toBe(current(finished).id);
  expect(ownCustomGameSetup(rematch, next, 'alice')).toBeNull();
  expect(ownCustomGameSetup(rematch, next, 'bob')).toBeNull();
});

test("the host's device and the room's scheduler play the same bot move", () => {
  // regression: custom-game-bot-move-differs-by-device
  const module = (random: number, authority: boolean) =>
    createSpaceModule(assertRoomModuleName('secret-room'), [secretPick, race], {
      now: () => 0,
      random: () => random,
      authority,
    });
  const device = module(0.05, false);
  const room = module(0.95, true);
  let state = decide(space('secret-pick'), 'alice', { operation: 'create' });
  state = decide(state, 'alice', { operation: 'swap' });
  state = decide(state, 'alice', { operation: 'bot', side: 'white' });
  state = decide(state, 'alice', { operation: 'ready', setup: 'n5' });
  state = decide(state, 'alice', { operation: 'start' });
  const wake = PlayCustomGameBot({
    gameId: current(state).id,
    ply: 0,
    side: 'white',
  });
  const moves = (result: HandleResult) => {
    if (!result.ok) throw new Error(reason(result));
    return current(result.events.reduce((s, e) => room.reduce(s, e), state))
      .moves;
  };
  // Both may play the due move: whichever the room takes first stands.
  const byRoom = moves(handle(room, state, ROOM_SCHEDULER_IDENTITY, wake));
  const prepared = device.prepareLocalCommand(state, wake, 1000);
  expect(moves(handle(room, state, 'alice', prepared))).toEqual(byRoom);
});
