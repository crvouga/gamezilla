import { expect, test } from 'bun:test';
import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import type {
  GameSessionChoice,
  GameSessionInput,
} from '@libs/game-session-shared-ts/game-session-choice';
import {
  ChangeGameSession,
  ChangeLocalGameSession,
  PlayGameSessionBot,
} from '@libs/game-session-shared-ts/game-session-commands';
import {
  GameSessionHandShown,
  GameSessionHiddenDealt,
  gameSessionHidden,
  ownGameSessionHand,
} from '@libs/game-session-shared-ts/game-session-hands';
import { soloGameSession } from '@libs/game-session-shared-ts/game-session-local';
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
import type { HandleResult, RoomState } from '@pkgs/room-root-shared-ts/types';
import { assertRoomModuleName } from '@pkgs/room-root-shared-ts/types';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { handDrawBots, handDrawRules } from './hand-draw';

const handDraw = defineGame({
  rules: handDrawRules,
  capabilities: { 'vs-human': {}, 'vs-bot': { bots: handDrawBots } },
  turnAutomation: { choose: () => null, perform: async () => {} },
});

function spaceModule(authority: boolean): SpaceModule {
  return createSpaceModule(assertRoomModuleName('hands-room'), [handDraw], {
    now: () => 0,
    random: () => 0.5,
    authority,
  });
}
const ROOM = spaceModule(true);
const DEVICE = spaceModule(false);

let commands = 0;
function handle(
  module: SpaceModule,
  state: RoomState,
  as: string,
  payload: Message
): HandleResult {
  commands += 1;
  return module.handle(state, { id: `h${commands}`, ts: 1000, payload }, as);
}

function command(state: RoomState, input: GameSessionInput): Message {
  const game = GameSessionsAttr.from(state).current;
  return ChangeGameSession({
    ...input,
    gameId: game?.id ?? null,
    revision: game?.revision ?? 0,
  } as Parameters<typeof ChangeGameSession>[0]);
}

function events(state: RoomState, as: string, input: GameSessionInput) {
  const result = handle(ROOM, state, as, command(state, input));
  if (!result.ok) throw new Error(`${as} ${input.operation} refused`);
  return result.events;
}

function reduce(state: RoomState, list: readonly Message[]): RoomState {
  return list.reduce((s, e) => ROOM.reduce(s, e), state);
}

/** What `person`'s device holds: only the events the room lets it read. */
function seenBy(person: string, state: RoomState, list: readonly Message[]) {
  return list
    .filter((e) => {
      const audience = ROOM.audience?.(e) ?? null;
      return audience === null || audience.includes(person);
    })
    .reduce((s, e) => DEVICE.reduce(s, e), state);
}

function current(state: RoomState): GameSession {
  const game = GameSessionsAttr.from(state).current;
  if (game === null) throw new Error('no game session');
  return game;
}

function space(): RoomState {
  return {
    ...ROOM.initialState(),
    ...GamesRoomAttr.selected('hand-draw'),
    ...SpaceMembersRoomAttr.seats({
      alice: { joinedAt: '2026-10-24' },
      bob: { joinedAt: '2026-10-24' },
    }),
  };
}

function readyToStart(): RoomState {
  let state = reduce(
    space(),
    events(space(), 'alice', { operation: 'create', mode: 'vs-human' })
  );
  state = reduce(
    state,
    events(state, 'bob', { operation: 'claim', side: 'black' })
  );
  state = reduce(state, events(state, 'alice', { operation: 'ready' }));
  return reduce(state, events(state, 'bob', { operation: 'ready' }));
}

test('the room deals as the game starts: the hidden state for nobody, each hand for its person', () => {
  const before = readyToStart();
  const dealt = events(before, 'alice', { operation: 'start' });
  const hidden = dealt.filter((e) => GameSessionHiddenDealt.is(e));
  const hands = dealt.filter((e) => GameSessionHandShown.is(e));
  expect(hidden).toHaveLength(1);
  expect(ROOM.audience?.(hidden[0]!)).toEqual([]);
  expect(hands.map((e) => ROOM.audience?.(e))).toEqual([['alice'], ['bob']]);
  const room = reduce(before, dealt);
  const alice = seenBy('alice', before, dealt);
  const game = current(room);
  expect(gameSessionHidden(room, game)).not.toBeNull();
  expect(gameSessionHidden(alice, current(alice))).toBeNull();
  expect(ownGameSessionHand(alice, current(alice), 'alice')).toBe(
    ownGameSessionHand(room, game, 'alice')
  );
  expect(ownGameSessionHand(alice, current(alice), 'bob')).toBeNull();
  expect(soloGameSession(game, createTurnGames([handDraw.turnGame]))).toBe(
    false
  );
});

test('a proposal is resolved by the room alone; a device predicts nothing', () => {
  const ready = readyToStart();
  const state = reduce(ready, events(ready, 'alice', { operation: 'start' }));
  const proposal = command(state, { operation: 'move', uci: 'swap', ply: 0 });
  expect(handle(DEVICE, state, 'alice', proposal)).toMatchObject({
    ok: true,
    events: [],
  });
  const result = handle(ROOM, state, 'alice', proposal);
  if (!result.ok) throw new Error('refused');
  // Only the mover's hand changed, so only it is shown again.
  expect(
    result.events
      .filter((e) => GameSessionHandShown.is(e))
      .map((e) => ROOM.audience?.(e))
  ).toEqual([['alice']]);
  expect(current(reduce(state, result.events)).moves.map((m) => m.uci)).toEqual(
    ['swap']
  );
});

test("a refused proposal is refused as every game's is and changes nothing", () => {
  const ready = readyToStart();
  const state = reduce(ready, events(ready, 'alice', { operation: 'start' }));
  const result = handle(
    ROOM,
    state,
    'alice',
    command(state, { operation: 'move', uci: 'flip', ply: 0 })
  );
  expect(result.ok).toBe(false);
  expect(!result.ok && 'reason' in result.error && result.error.reason).toBe(
    'not a move'
  );
});

test('a bot proposes from its own hand, which only a solo game’s creator reads', () => {
  let state = reduce(
    space(),
    events(space(), 'alice', { operation: 'create', mode: 'vs-bot' })
  );
  state = reduce(
    state,
    events(state, 'alice', { operation: 'bot', side: 'black' })
  );
  state = reduce(state, events(state, 'alice', { operation: 'ready' }));
  const dealt = events(state, 'alice', { operation: 'start' });
  const botHand = dealt.find(
    (e) => GameSessionHandShown.is(e) && e.payload.side === 'black'
  )!;
  expect(ROOM.audience?.(botHand)).toEqual(['alice']);
  state = reduce(state, dealt);
  state = reduce(
    state,
    events(state, 'alice', { operation: 'move', uci: 'keep', ply: 0 })
  );
  const game = current(state);
  const wake = handle(
    ROOM,
    state,
    ROOM_SCHEDULER_IDENTITY,
    PlayGameSessionBot({ gameId: game.id, ply: 1, side: 'black' })
  );
  if (!wake.ok) throw new Error('bot refused');
  const played = current(reduce(state, wake.events));
  const blackCard = Number(
    GameSessionHandShown.is(botHand) ? botHand.payload.hand : 0
  );
  expect(played.moves[1]?.uci).toBe(blackCard >= 4 ? 'keep' : 'swap');
});

/** The creator's device, drawing its own numbers. */
function practiceDevice(): SpaceModule {
  const draws = [0.1, 0.7, 0.3, 0.9, 0.2, 0.6];
  return createSpaceModule(assertRoomModuleName('hands-room'), [handDraw], {
    now: () => 0,
    random: () => draws.shift() ?? 0.5,
    authority: false,
  });
}

function againstBot(): RoomState {
  let state = reduce(
    space(),
    events(space(), 'alice', { operation: 'create', mode: 'vs-bot' })
  );
  state = reduce(
    state,
    events(state, 'alice', { operation: 'bot', side: 'black' })
  );
  return reduce(state, events(state, 'alice', { operation: 'ready' }));
}

function local(state: RoomState, input: GameSessionInput): Message {
  return ChangeLocalGameSession({
    choice: command(state, input).payload as GameSessionChoice,
    at: 1000,
  });
}

/** The same command on the creator's device and in the room: the same events. */
function bothDecide(device: SpaceModule, state: RoomState, payload: Message) {
  const prepared = device.prepareLocalCommand(state, payload, 1000);
  commands += 1;
  const sent = { id: `h${commands}`, ts: 1000, payload: prepared };
  const onDevice = device.handle(state, sent, 'alice');
  const inRoom = ROOM.handle(state, sent, 'alice');
  if (!onDevice.ok || !inRoom.ok) throw new Error('refused');
  expect(onDevice.events).toEqual(inRoom.events);
  return inRoom.events;
}

test('practising against a bot, the device deals, plays and moves the bot as the room does', () => {
  const device = practiceDevice();
  const ready = againstBot();
  const dealt = bothDecide(device, ready, local(ready, { operation: 'start' }));
  expect(
    dealt
      .filter((e) => GameSessionHiddenDealt.is(e) || GameSessionHandShown.is(e))
      .map((e) => ROOM.audience?.(e))
  ).toEqual([['alice'], ['alice'], ['alice']]);
  let state = reduce(ready, dealt);
  expect(
    soloGameSession(current(state), createTurnGames([handDraw.turnGame]))
  ).toBe(true);
  state = reduce(
    state,
    bothDecide(
      device,
      state,
      local(state, { operation: 'move', uci: 'swap', ply: 0 })
    )
  );
  const game = current(state);
  state = reduce(
    state,
    bothDecide(
      device,
      state,
      PlayGameSessionBot({ gameId: game.id, ply: 1, side: 'black' })
    )
  );
  expect(current(state).moves).toHaveLength(2);
});

test('a start without the creator’s draws is dealt by the room alone', () => {
  const ready = againstBot();
  const start = local(ready, { operation: 'start' });
  const onDevice = handle(DEVICE, ready, 'alice', start);
  if (!onDevice.ok) throw new Error('refused');
  expect(onDevice.events.some((e) => GameSessionHiddenDealt.is(e))).toBe(false);
});

test('a game with another person never takes a device’s draws', () => {
  const ready = readyToStart();
  const start = practiceDevice().prepareLocalCommand(
    ready,
    local(ready, { operation: 'start' }),
    1000
  );
  const result = handle(ROOM, ready, 'alice', start);
  expect(!result.ok && 'reason' in result.error && result.error.reason).toBe(
    'connection needed'
  );
});

test('with another person at the table, nobody but the room chooses a bot’s move', () => {
  const fourSeats = defineGame({
    rules: {
      ...handDrawRules,
      id: 'hand-draw-four',
      sides: ['white', 'black', 'red', 'blue'],
    },
    capabilities: { 'vs-human': {}, 'vs-bot': { bots: handDrawBots } },
    turnAutomation: { choose: () => null, perform: async () => {} },
  });
  const room = createSpaceModule(
    assertRoomModuleName('hands-room'),
    [fourSeats],
    { now: () => 0, random: () => 0.5, authority: true }
  );
  const decide = (state: RoomState, as: string, input: GameSessionInput) => {
    const result = handle(room, state, as, command(state, input));
    if (!result.ok) throw new Error(`${as} ${input.operation} refused`);
    return result.events.reduce((s, e) => room.reduce(s, e), state);
  };
  let state: RoomState = {
    ...room.initialState(),
    ...GamesRoomAttr.selected('hand-draw-four'),
    ...SpaceMembersRoomAttr.seats({
      alice: { joinedAt: '2026-10-24' },
      bob: { joinedAt: '2026-10-24' },
    }),
  };
  state = decide(state, 'alice', { operation: 'create', mode: 'vs-human' });
  state = decide(state, 'bob', { operation: 'claim', side: 'black' });
  // An earlier saved four-seat table can contain both people and bots.
  const bot = { kind: 'bot', person: '' } as const;
  state = {
    ...state,
    ...GameSessionsAttr({
      history: [],
      current: { ...current(state), red: bot, blue: bot },
    }),
  };
  state = decide(state, 'alice', { operation: 'ready' });
  state = decide(state, 'bob', { operation: 'ready' });
  state = decide(state, 'alice', { operation: 'start' });
  const game = current(state);
  const chosen = handle(
    room,
    state,
    'alice',
    PlayGameSessionBot({
      gameId: game.id,
      ply: game.moves.length,
      side: 'red',
      at: 1000,
      move: 'swap',
    })
  );
  expect(!chosen.ok && 'reason' in chosen.error && chosen.error.reason).toBe(
    'only the game may move a bot or end a clock'
  );
});
