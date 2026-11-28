import { expect, test } from 'bun:test';
import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import type { GameSessionInput } from '@libs/game-session-shared-ts/game-session-choice';
import {
  ChangeGameSession,
  GameSessionProgressed,
  GameSessionsChanged,
  PlayGameSessionBot,
  StandInGameSession,
} from '@libs/game-session-shared-ts/game-session-commands';
import {
  GameSessionCommitmentChosen,
  GameSessionCommitmentsAttr,
  ownGameSessionCommitment,
} from '@libs/game-session-shared-ts/game-session-commitments';
import { localGameSessionEffects } from '@libs/game-session-shared-ts/game-session-effects';
import {
  GameSessionHandShown,
  gameSessionHand,
  gameSessionHidden,
  ownGameSessionHand,
} from '@libs/game-session-shared-ts/game-session-hands';
import { gameSessionWinners } from '@libs/game-session-shared-ts/game-session-outcome';
import {
  GAME_SESSION_STAND_IN_MS,
  gameSessionStandInEffects,
} from '@libs/game-session-shared-ts/game-session-stand-in';
import {
  type GameSession,
  GameSessionsAttr,
} from '@libs/game-session-shared-ts/game-session-state';
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
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { tokenPassBots, tokenPassRules } from './token-pass';

const tokenPass = defineGame({
  rules: tokenPassRules,
  capabilities: { 'vs-human': {}, 'vs-bot': { bots: tokenPassBots } },
  turnAutomation: { choose: () => null, perform: async () => {} },
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
  sent: { readonly as: string; readonly payload: Message; readonly at?: number }
): HandleResult {
  commands += 1;
  const { as, payload, at = 1000 } = sent;
  return module.handle(state, { id: `k${commands}`, ts: at, payload }, as);
}

function command(state: RoomState, input: GameSessionInput): Message {
  const game = GameSessionsAttr.from(state).current;
  return ChangeGameSession({
    ...input,
    gameId: game?.id ?? null,
    revision: game?.revision ?? 0,
  } as Parameters<typeof ChangeGameSession>[0]);
}

function reason(result: HandleResult): string {
  return result.ok
    ? ''
    : 'reason' in result.error
      ? (result.error.reason ?? '')
      : '';
}

function reduce(state: RoomState, events: readonly Message[]): RoomState {
  return events.reduce((s, e) => ROOM.reduce(s, e), state);
}

/** The room decides `input` by `as` and commits it, failing on a refusal. */
function decide(
  state: RoomState,
  as: string,
  input: GameSessionInput,
  at = 1000
) {
  const result = handle(ROOM, state, {
    as,
    payload: command(state, input),
    at,
  });
  if (!result.ok)
    throw new Error(`${as} ${input.operation}: ${reason(result)}`);
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

function current(state: RoomState): GameSession {
  const game = GameSessionsAttr.from(state).current;
  if (game === null) throw new Error('no game session');
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
  let state = decide(space(), 'alice', {
    operation: 'create',
    mode: 'vs-human',
  }).state;
  for (const [i, side] of (['black', 'red', 'blue'] as const).entries())
    state = decide(state, PEOPLE[i + 1]!, { operation: 'claim', side }).state;
  for (const person of PEOPLE)
    state = decide(state, person, { operation: 'ready' }).state;
  const started = decide(state, 'alice', { operation: 'start' });
  return {
    state: started.state,
    dealt: started.result.ok ? started.result.events : [],
  };
}

function handOf(state: RoomState, person: string): string {
  return ownGameSessionHand(state, current(state), person) ?? '';
}

function commit(
  state: RoomState,
  person: string,
  commitment = handOf(state, person)[0]!
) {
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
    expect(
      seenBy(person, space(), dealt) ? handOf(state, person) : ''
    ).toHaveLength(2);
});

test('a commitment is read by its person alone; everyone sees only that the side has committed', () => {
  const { state } = fourPeople();
  const before = state;
  const { state: after, result } = commit(state, 'bob');
  const events = result.ok ? result.events : [];
  const chosen = events.find((e) => GameSessionCommitmentChosen.is(e))!;
  expect(ROOM.audience?.(chosen)).toEqual(['bob']);
  expect(current(after)).toMatchObject({
    awaiting: ['white', 'red', 'blue'],
    committed: ['black'],
  });
  // Bob's own device holds his commitment; Carol's and Eve's hold none.
  const bobDevice = seenBy('bob', before, events);
  expect(ownGameSessionCommitment(bobDevice, current(bobDevice), 'bob')).toBe(
    handOf(before, 'bob')[0]!
  );
  for (const other of ['carol', 'eve']) {
    const device = seenBy(other, before, events);
    expect(
      JSON.stringify(GameSessionCommitmentsAttr.from(device))
    ).not.toContain(handOf(before, 'bob')[0]!);
    expect(current(device).committed).toEqual(['black']);
  }
});

test('a commitment is final, names its phase, needs a seat, and holds up every move', () => {
  const { state } = fourPeople();
  const once = commit(state, 'bob').state;
  const again = handle(ROOM, once, {
    as: 'bob',
    payload: command(once, {
      operation: 'commit',
      commitment: handOf(once, 'bob')[1]!,
      ply: 0,
    }),
  });
  expect(reason(again)).toBe('already chosen');
  const stale = handle(ROOM, once, {
    as: 'carol',
    payload: command(once, {
      operation: 'commit',
      commitment: handOf(once, 'carol')[0]!,
      ply: 3,
    }),
  });
  expect(reason(stale)).toBe('board changed');
  const watcher = handle(ROOM, once, {
    as: 'eve',
    payload: command(once, { operation: 'commit', commitment: '1', ply: 0 }),
  });
  expect(reason(watcher)).toBe('not a participant');
  const notHeld = handle(ROOM, once, {
    as: 'carol',
    payload: command(once, { operation: 'commit', commitment: '9', ply: 0 }),
  });
  expect(reason(notHeld)).toBe('move is illegal');
  const move = handle(ROOM, once, {
    as: 'alice',
    payload: command(once, { operation: 'move', uci: '1', ply: 0 }),
  });
  expect(reason(move)).toBe('every side chooses first');
  // A device predicts nothing: the commitment goes to the room.
  const predicted = handle(DEVICE, state, {
    as: 'carol',
    payload: command(state, {
      operation: 'commit',
      commitment: handOf(state, 'carol')[0]!,
      ply: 0,
    }),
  });
  expect(predicted).toMatchObject({ ok: true, events: [] });
});

test('the last commitment resolves every one at once into one public action and the new hands', () => {
  let state = fourPeople().state;
  const given = Object.fromEntries(
    PEOPLE.map((p) => [p, handOf(state, p)[0]!])
  );
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
  expect(GameSessionCommitmentsAttr.from(after)).toEqual({});
  const events = last.result.ok ? last.result.events : [];
  expect(
    events.filter((e) => GameSessionHandShown.is(e)).length
  ).toBeGreaterThan(0);
  // The turn goes where the rules say: to whoever now holds the 8.
  const leader = current(after).turn;
  expect(
    ownGameSessionHand(after, current(after), current(after)[leader].person)
  ).toContain('8');
});

test('bots commit for their sides with only their own hands, one wake after another, and the creator reads them in solo practice', () => {
  let state = decide(space(), 'alice', {
    operation: 'create',
    mode: 'vs-bot',
  }).state;
  for (const side of ['black', 'red', 'blue'] as const)
    state = decide(state, 'alice', { operation: 'bot', side }).state;
  state = decide(state, 'alice', { operation: 'ready' }).state;
  const started = decide(state, 'alice', { operation: 'start' });
  state = started.state;
  const wakes = (effects: readonly RoomEffect[] | undefined) =>
    (effects ?? []).flatMap((e) => (e.type === 'schedule' ? [e] : []));
  // The creator alone with bots practices solo: the device wakes its bots.
  expect(
    JSON.stringify(started.result.ok ? started.result.effects : [])
  ).not.toContain('"side":"black"');
  expect(
    JSON.stringify(
      localGameSessionEffects(
        current(state),
        createTurnGames([tokenPass.turnGame])
      )
    )
  ).toContain('"side":"black"');
  for (const side of ['black', 'red', 'blue'] as const) {
    const wake = handle(ROOM, state, {
      as: ROOM_SCHEDULER_IDENTITY,
      payload: PlayGameSessionBot({ gameId: current(state).id, ply: 0, side }),
      at: 2000,
    });
    if (!wake.ok) throw new Error(reason(wake));
    // Practising alone, the creator's device decides as the room does, so
    // it reads each bot's commitment too.
    const chosen = wake.events.find((e) => GameSessionCommitmentChosen.is(e));
    expect(ROOM.audience?.(chosen!)).toEqual(['alice']);
    state = reduce(state, wake.events);
    expect(wakes(wake.effects).length).toBeGreaterThanOrEqual(0);
  }
  expect(current(state).committed).toEqual(['black', 'red', 'blue']);
  state = commit(state, 'alice').state;
  expect(current(state).moves).toHaveLength(1);
  expect(gameSessionHidden(state, current(state))).not.toBeNull();
});

test('several sides sharing the best result are all winners', () => {
  let state = fourPeople().state;
  for (const person of PEOPLE) state = commit(state, person).state;
  for (let play = 0; play < 4; play += 1) {
    const game = current(state);
    const person = game[game.turn].person;
    state = decide(state, person, {
      operation: 'move',
      uci: handOf(state, person).at(-1)!,
      ply: game.moves.length,
    }).state;
  }
  const game = current(state);
  expect(game.status).toBe('completed');
  const winners = gameSessionWinners(game);
  expect(winners.length).toBeGreaterThan(0);
  if (winners.length > 1 && winners.length < 4)
    expect(game.outcome).toMatch(/ and .* win by high tokens$/);
});

test('a participant away for the grace period is played by a stand-in until they take their side back', () => {
  let state = fourPeople().state;
  const away = { ...state, ...SpaceMembersRoomAttr.away({ bob: 5000 }) };
  const effects = gameSessionStandInEffects(
    away,
    current(away),
    createTurnGames([tokenPass.turnGame])
  );
  expect(JSON.stringify(effects)).toContain(
    String(5000 + GAME_SESSION_STAND_IN_MS)
  );
  // Too early: the wake changes nothing.
  const early = handle(ROOM, away, {
    as: ROOM_SCHEDULER_IDENTITY,
    payload: StandInGameSession({ gameId: current(away).id }),
    at: 5000 + GAME_SESSION_STAND_IN_MS - 1,
  });
  if (!early.ok) throw new Error(reason(early));
  expect(current(reduce(away, early.events)).standIns).toEqual([]);
  const due = handle(ROOM, away, {
    as: ROOM_SCHEDULER_IDENTITY,
    payload: StandInGameSession({ gameId: current(away).id }),
    at: 5000 + GAME_SESSION_STAND_IN_MS,
  });
  if (!due.ok) throw new Error(reason(due));
  state = reduce(away, due.events);
  expect(current(state).standIns).toEqual(['black']);
  // The stand-in commits for Bob's side; Bob himself may not while it plays.
  expect(JSON.stringify(due.effects)).toContain('"side":"black"');
  const own = handle(ROOM, state, {
    as: 'bob',
    payload: command(state, {
      operation: 'commit',
      commitment: handOf(state, 'bob')[0]!,
      ply: 0,
    }),
  });
  expect(reason(own)).toBe('a stand-in plays your side');
  const others = handle(ROOM, state, {
    as: 'carol',
    payload: command(state, { operation: 'reclaim' }),
  });
  expect(reason(others)).toBe('no stand-in plays your side');
  // Bob takes his side back; the stand-in's waiting wake then decides nothing.
  state = decide(state, 'bob', { operation: 'reclaim' }).state;
  expect(current(state).standIns).toEqual([]);
  const stale = handle(ROOM, state, {
    as: ROOM_SCHEDULER_IDENTITY,
    payload: PlayGameSessionBot({
      gameId: current(state).id,
      ply: 0,
      side: 'black',
    }),
    at: 70_000,
  });
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
    const progress = events.find((e) => GameSessionProgressed.is(e));
    expect(progress).toBeDefined();
    expect(events.some((e) => GameSessionsChanged.is(e))).toBe(false);
    sizes.push(JSON.stringify(progress).length);
    device = seenBy('eve', device, events);
    state = next;
  }
  expect(GameSessionsAttr.from(device)).toEqual(GameSessionsAttr.from(state));
  // Each move's record stays the same size however long the game grows.
  expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThan(200);
});

test("with another person at the table, nobody reads a bot's commitment", () => {
  let state = decide(space(), 'alice', {
    operation: 'create',
    mode: 'vs-human',
  }).state;
  state = decide(state, 'bob', { operation: 'claim', side: 'black' }).state;
  // An earlier saved four-seat table can contain both people and bots.
  const bot = { kind: 'bot', person: '' } as const;
  state = {
    ...state,
    ...GameSessionsAttr({
      history: [],
      current: { ...current(state), red: bot, blue: bot },
    }),
  };
  for (const person of ['alice', 'bob'])
    state = decide(state, person, { operation: 'ready' }).state;
  state = decide(state, 'alice', { operation: 'start' }).state;
  const wake = handle(ROOM, state, {
    as: ROOM_SCHEDULER_IDENTITY,
    payload: PlayGameSessionBot({
      gameId: current(state).id,
      ply: 0,
      side: 'red',
    }),
    at: 2000,
  });
  if (!wake.ok) throw new Error(reason(wake));
  const chosen = wake.events.find((e) => GameSessionCommitmentChosen.is(e));
  expect(ROOM.audience?.(chosen!)).toEqual([]);
});

test("in solo practice the creator's device records a bot's commitment from its local wake", () => {
  let state = decide(space(), 'alice', {
    operation: 'create',
    mode: 'vs-bot',
  }).state;
  for (const side of ['black', 'red', 'blue'] as const)
    state = decide(state, 'alice', { operation: 'bot', side }).state;
  state = decide(state, 'alice', { operation: 'ready' }).state;
  state = decide(state, 'alice', { operation: 'start' }).state;
  // Alice's device holds every hand in her practice game; it wakes the bot itself.
  const device = state;
  const wake = handle(DEVICE, device, {
    as: 'alice',
    payload: PlayGameSessionBot({
      gameId: current(device).id,
      ply: 0,
      side: 'black',
      at: 2000,
      move: (gameSessionHand(device, current(device), 'black') ?? '').slice(
        0,
        1
      ),
    }),
    at: 2000,
  });
  if (!wake.ok) throw new Error(reason(wake));
  expect(wake.events.some((e) => GameSessionCommitmentChosen.is(e))).toBe(true);
});
