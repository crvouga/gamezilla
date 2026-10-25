import { expect, test } from 'bun:test';
import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import {
  ChangeCustomGame,
  CustomGameProgressed,
  CustomGamesChanged,
  PlayCustomGameBot,
  StandInCustomGame,
} from '@libs/game-session-shared-ts/custom-game-commands';
import {
  CustomGameCommitmentChosen,
  CustomGameCommitmentsAttr,
  ownCustomGameCommitment,
} from '@libs/game-session-shared-ts/custom-game-commitments';
import {
  CustomGameHandShown,
  customGameHidden,
  ownCustomGameHand,
} from '@libs/game-session-shared-ts/custom-game-hands';
import { customGameWinners } from '@libs/game-session-shared-ts/custom-game-outcome';
import {
  CUSTOM_GAME_STAND_IN_MS,
  customGameStandInEffects,
} from '@libs/game-session-shared-ts/custom-game-stand-in';
import {
  type CustomGame,
  CustomGamesAttr,
} from '@libs/game-session-shared-ts/custom-game-state';
import { defineTurnGame } from '@libs/game-session-shared-ts/turn-game-definition';
import { GamesRoomAttr } from '@libs/spaces-shared-ts/games';
import { SpaceMembersRoomAttr } from '@libs/spaces-shared-ts/space-members-messages';
import {
  createSpaceModule,
  type SpaceModule,
} from '@libs/spaces-shared-ts/space-module';
import type { Message } from '@pkgs/message-shared-ts/message';
import { ROOM_SCHEDULER_IDENTITY } from '@pkgs/room-root-shared-ts/builtin';
import type {
  HandleResult,
  RoomEffect,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';
import { assertRoomModuleName } from '@pkgs/room-root-shared-ts/types';
import { tokenPassBots, tokenPassRules } from './token-pass';

const tokenPass = defineTurnGame({
  rules: tokenPassRules,
  capabilities: { 'custom-games': { bots: tokenPassBots } },
  automation: { choose: () => null, perform: async () => {} },
});

function spaceModule(authority: boolean): SpaceModule {
  return createSpaceModule(assertRoomModuleName('commit-room'), [tokenPass], {
    now: () => 0,
    random: () => 0.37,
    authority,
  });
}
const ROOM = spaceModule(true);
const DEVICE = spaceModule(false);
const PEOPLE = ['alice', 'bob', 'carol', 'dave'] as const;

let commands = 0;
function handle(
  module: SpaceModule,
  state: RoomState,
  as: string,
  payload: Message,
  at = 1000
): HandleResult {
  commands += 1;
  return module.handle(state, { id: `k${commands}`, ts: at, payload }, as);
}

function command(state: RoomState, input: CustomGameInput): Message {
  const game = CustomGamesAttr.from(state).current;
  return ChangeCustomGame({
    ...input,
    gameId: game?.id ?? null,
    revision: game?.revision ?? 0,
  } as Parameters<typeof ChangeCustomGame>[0]);
}

function reason(result: HandleResult): string {
  return result.ok ? '' : 'reason' in result.error ? (result.error.reason ?? '') : '';
}

function reduce(state: RoomState, events: readonly Message[]): RoomState {
  return events.reduce((s, e) => ROOM.reduce(s, e), state);
}

/** The room decides `input` by `as` and commits it, failing on a refusal. */
function decide(state: RoomState, as: string, input: CustomGameInput, at = 1000) {
  const result = handle(ROOM, state, as, command(state, input), at);
  if (!result.ok) throw new Error(`${as} ${input.operation}: ${reason(result)}`);
  return { state: reduce(state, result.events), result };
}

/** What `person`'s device holds: only the events the room lets them read. */
function seenBy(person: string, before: RoomState, events: readonly Message[]) {
  return events
    .filter((e) => {
      const audience = ROOM.audience?.(e) ?? null;
      return audience === null || audience.includes(person);
    })
    .reduce((s, e) => DEVICE.reduce(s, e), before);
}

function current(state: RoomState): CustomGame {
  const game = CustomGamesAttr.from(state).current;
  if (game === null) throw new Error('no custom game');
  return game;
}

function space(): RoomState {
  return {
    ...ROOM.initialState(),
    ...GamesRoomAttr.selected('token-pass'),
    ...SpaceMembersRoomAttr.seats(
      Object.fromEntries(
        [...PEOPLE, 'eve'].map((person) => [person, { joinedAt: '2026-10-24' }])
      )
    ),
  };
}

/** Four people seated and started; the room has dealt every hand. */
function fourPeople(): { state: RoomState; dealt: readonly Message[] } {
  let state = decide(space(), 'alice', { operation: 'create' }).state;
  for (const [i, side] of (['black', 'red', 'blue'] as const).entries())
    state = decide(state, PEOPLE[i + 1]!, { operation: 'claim', side }).state;
  for (const person of PEOPLE) state = decide(state, person, { operation: 'ready' }).state;
  const started = decide(state, 'alice', { operation: 'start' });
  return { state: started.state, dealt: started.result.ok ? started.result.events : [] };
}

function handOf(state: RoomState, person: string): string {
  return ownCustomGameHand(state, current(state), person) ?? '';
}

function commit(state: RoomState, person: string, commitment = handOf(state, person)[0]!) {
  return decide(state, person, {
    operation: 'commit',
    commitment,
    ply: current(state).moves.length,
  });
}

test('a phase of commitments opens with the game, every side awaited and none committed', () => {
  const { state, dealt } = fourPeople();
  expect(current(state)).toMatchObject({
    status: 'active',
    awaiting: ['white', 'black', 'red', 'blue'],
    committed: [],
  });
  for (const person of PEOPLE)
    expect(seenBy(person, space(), dealt) ? handOf(state, person) : '').toHaveLength(2);
});

test('a commitment is read by its person alone; everyone sees only that the side has committed', () => {
  const { state } = fourPeople();
  const before = state;
  const { state: after, result } = commit(state, 'bob');
  const events = result.ok ? result.events : [];
  const chosen = events.find((e) => CustomGameCommitmentChosen.is(e))!;
  expect(ROOM.audience?.(chosen)).toEqual(['bob']);
  expect(current(after)).toMatchObject({
    awaiting: ['white', 'red', 'blue'],
    committed: ['black'],
  });
  // Bob's own device holds his commitment; Carol's and Eve's hold none.
  const bobDevice = seenBy('bob', before, events);
  expect(ownCustomGameCommitment(bobDevice, current(bobDevice), 'bob')).toBe(handOf(before, 'bob')[0]!);
  for (const other of ['carol', 'eve']) {
    const device = seenBy(other, before, events);
    expect(JSON.stringify(CustomGameCommitmentsAttr.from(device))).not.toContain(
      handOf(before, 'bob')[0]!
    );
    expect(current(device).committed).toEqual(['black']);
  }
});

test('a commitment is final, names its phase, needs a seat, and holds up every move', () => {
  const { state } = fourPeople();
  const once = commit(state, 'bob').state;
  const again = handle(ROOM, once, 'bob', command(once, { operation: 'commit', commitment: handOf(once, 'bob')[1]!, ply: 0 }));
  expect(reason(again)).toBe('already chosen');
  const stale = handle(ROOM, once, 'carol', command(once, { operation: 'commit', commitment: handOf(once, 'carol')[0]!, ply: 3 }));
  expect(reason(stale)).toBe('board changed');
  const watcher = handle(ROOM, once, 'eve', command(once, { operation: 'commit', commitment: '1', ply: 0 }));
  expect(reason(watcher)).toBe('not a participant');
  const notHeld = handle(ROOM, once, 'carol', command(once, { operation: 'commit', commitment: '9', ply: 0 }));
  expect(reason(notHeld)).toBe('move is illegal');
  const move = handle(ROOM, once, 'alice', command(once, { operation: 'move', uci: '1', ply: 0 }));
  expect(reason(move)).toBe('every side chooses first');
  // A device predicts nothing: the commitment goes to the room.
  const predicted = handle(DEVICE, state, 'carol', command(state, { operation: 'commit', commitment: handOf(state, 'carol')[0]!, ply: 0 }));
  expect(predicted).toMatchObject({ ok: true, events: [] });
});

test('the last commitment resolves every one at once into one public action and the new hands', () => {
  let state = fourPeople().state;
  const given = Object.fromEntries(PEOPLE.map((p) => [p, handOf(state, p)[0]!]));
  for (const person of PEOPLE.slice(0, 3)) state = commit(state, person).state;
  expect(current(state).moves).toEqual([]);
  const last = commit(state, 'dave');
  const after = last.state;
  expect(current(after).moves).toHaveLength(1);
  expect(current(after).moves[0]!.uci).toMatch(/^passed:/);
  expect(current(after)).toMatchObject({ awaiting: [], committed: [] });
  // Each side received the token passed by the side on its right.
  expect(handOf(after, 'bob')).toContain(given['alice']!);
  expect(handOf(after, 'alice')).toContain(given['dave']!);
  expect(CustomGameCommitmentsAttr.from(after)).toEqual({});
  const events = last.result.ok ? last.result.events : [];
  expect(events.filter((e) => CustomGameHandShown.is(e)).length).toBeGreaterThan(0);
  // The turn goes where the rules say: to whoever now holds the 8.
  const leader = current(after).turn;
  expect(ownCustomGameHand(after, current(after), current(after)[leader].person)).toContain('8');
});

test('bots commit for their sides with only their own hands, one wake after another', () => {
  let state = decide(space(), 'alice', { operation: 'create' }).state;
  for (const side of ['black', 'red', 'blue'] as const)
    state = decide(state, 'alice', { operation: 'bot', side }).state;
  state = decide(state, 'alice', { operation: 'ready' }).state;
  const started = decide(state, 'alice', { operation: 'start' });
  state = started.state;
  const wakes = (effects: readonly RoomEffect[] | undefined) =>
    (effects ?? []).flatMap((e) => (e.type === 'schedule' ? [e] : []));
  expect(JSON.stringify(started.result.ok ? started.result.effects : [])).toContain('"side":"black"');
  for (const side of ['black', 'red', 'blue'] as const) {
    const wake = handle(ROOM, state, ROOM_SCHEDULER_IDENTITY, PlayCustomGameBot({ gameId: current(state).id, ply: 0, side }), 2000);
    if (!wake.ok) throw new Error(reason(wake));
    state = reduce(state, wake.events);
    expect(wakes(wake.effects).length).toBeGreaterThanOrEqual(0);
  }
  expect(current(state).committed).toEqual(['black', 'red', 'blue']);
  state = commit(state, 'alice').state;
  expect(current(state).moves).toHaveLength(1);
  expect(customGameHidden(state, current(state))).not.toBeNull();
});

test('several sides sharing the best result are all winners', () => {
  let state = fourPeople().state;
  for (const person of PEOPLE) state = commit(state, person).state;
  for (let play = 0; play < 4; play += 1) {
    const game = current(state);
    const person = game[game.turn].person;
    state = decide(state, person, { operation: 'move', uci: handOf(state, person).at(-1)!, ply: game.moves.length }).state;
  }
  const game = current(state);
  expect(game.status).toBe('completed');
  const winners = customGameWinners(game);
  expect(winners.length).toBeGreaterThan(0);
  if (winners.length > 1 && winners.length < 4)
    expect(game.outcome).toMatch(/ and .* win by high tokens$/);
});

test('a participant away for the grace period is played by a stand-in until they take their side back', () => {
  let state = fourPeople().state;
  const away = { ...state, ...SpaceMembersRoomAttr.away({ bob: 5000 }) };
  const effects = customGameStandInEffects(away, current(away));
  expect(JSON.stringify(effects)).toContain(String(5000 + CUSTOM_GAME_STAND_IN_MS));
  // Too early: the wake changes nothing.
  const early = handle(ROOM, away, ROOM_SCHEDULER_IDENTITY, StandInCustomGame({ gameId: current(away).id }), 5000 + CUSTOM_GAME_STAND_IN_MS - 1);
  if (!early.ok) throw new Error(reason(early));
  expect(current(reduce(away, early.events)).standIns).toEqual([]);
  const due = handle(ROOM, away, ROOM_SCHEDULER_IDENTITY, StandInCustomGame({ gameId: current(away).id }), 5000 + CUSTOM_GAME_STAND_IN_MS);
  if (!due.ok) throw new Error(reason(due));
  state = reduce(away, due.events);
  expect(current(state).standIns).toEqual(['black']);
  // The stand-in commits for Bob's side; Bob himself may not while it plays.
  expect(JSON.stringify(due.effects)).toContain('"side":"black"');
  const own = handle(ROOM, state, 'bob', command(state, { operation: 'commit', commitment: handOf(state, 'bob')[0]!, ply: 0 }));
  expect(reason(own)).toBe('a stand-in plays your side');
  const others = handle(ROOM, state, 'carol', command(state, { operation: 'reclaim' }));
  expect(reason(others)).toBe('no stand-in plays your side');
  // Bob takes his side back; the stand-in's waiting wake then decides nothing.
  state = decide(state, 'bob', { operation: 'reclaim' }).state;
  expect(current(state).standIns).toEqual([]);
  const stale = handle(ROOM, state, ROOM_SCHEDULER_IDENTITY, PlayCustomGameBot({ gameId: current(state).id, ply: 0, side: 'black' }), 70_000);
  if (!stale.ok) throw new Error(reason(stale));
  expect(current(reduce(state, stale.events)).committed).toEqual([]);
  expect(commit(state, 'bob').state).toBeDefined();
});

test('a move is recorded as just what it adds, and every copy folding the log holds the same games', () => {
  let state = fourPeople().state;
  let device = state;
  const sizes: number[] = [];
  for (const person of PEOPLE) state = commit(state, person).state;
  device = state;
  for (let play = 0; play < 4; play += 1) {
    const game = current(state);
    const person = game[game.turn].person;
    const { state: next, result } = decide(state, person, {
      operation: 'move',
      uci: handOf(state, person).at(-1)!,
      ply: game.moves.length,
    });
    const events = result.ok ? result.events : [];
    const progress = events.find((e) => CustomGameProgressed.is(e));
    expect(progress).toBeDefined();
    expect(events.some((e) => CustomGamesChanged.is(e))).toBe(false);
    sizes.push(JSON.stringify(progress).length);
    device = seenBy('eve', device, events);
    state = next;
  }
  expect(CustomGamesAttr.from(device)).toEqual(CustomGamesAttr.from(state));
  // Each move's record stays the same size however long the game grows.
  expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThan(200);
});
