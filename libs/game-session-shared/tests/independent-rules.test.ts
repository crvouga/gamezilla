import { expect, test } from 'bun:test';
import {
  ChangeCustomGame,
  PlayCustomGameBot,
} from '@libs/game-session-shared/custom-game-commands';
import { CustomGamesAttr } from '@libs/game-session-shared/custom-game-state';
import { GAME_ROOM_CAPABILITY } from '@libs/game-session-shared/game-room-capability';
import { GamesRoomAttr } from '@libs/spaces-shared/games';
import { SpaceMembersRoomAttr } from '@libs/spaces-shared/space-members-messages';
import { createSpaceModule } from '@libs/spaces-shared/space-module';
import { ROOM_SCHEDULER_IDENTITY } from '@pkgs/room-root-shared/builtin';
import { assertRoomModuleName } from '@pkgs/room-root-shared/types';
import type {
  GameCapability,
  GameRules,
} from '@pkgs/turn-game-shared/game-rules';

/** A counting race exercises opaque actions and positions unrelated to a board. */
const rules: GameRules = {
  botDifficulties: [],
  id: 'counting-race',
  recognizes: (position) => /^race:[0-4]$/.test(position),
  initial: () => 'race:0',
  play(position, action) {
    const count = Number(position.slice(5));
    if (action !== 'advance-token' || count >= 4) return null;
    return {
      position: `race:${count + 1}`,
      history: String(count + 1),
      turn: count % 2 === 0 ? 'black' : 'white',
      label: `step ${count + 1}`,
      winner: count === 3 ? 'black' : null,
      reason: count === 3 ? 'finish line' : null,
    };
  },
  replay: (_actions, ply) => `race:${ply}`,
  legal: (position) => (position === 'race:4' ? [] : ['advance-token']),
  canWin: () => true,
  choose: (position) => (position === 'race:4' ? null : 'advance-token'),
  moves: () => [],
  record: (position) => position,
};
const notice = {
  timeoutDraw: () => 'drawn on time',
  side: (side: string) => side,
  ending: () => undefined,
};

function raceRoom(capabilities: readonly GameCapability[]) {
  const definition = {
    id: rules.id,
    turnGame: { rules, controlPrefix: 'race/', notice, capabilities },
    commandRouters: [],
    eventRouters: [],
    recoverEffects: () => [],
    roomCapabilities: [GAME_ROOM_CAPABILITY],
  };
  const module = createSpaceModule(
    assertRoomModuleName('race-room'),
    [definition],
    () => 0,
    () => 0
  );
  const state = {
    ...module.initialState(),
    ...GamesRoomAttr.selected(rules.id),
    ...SpaceMembersRoomAttr.seats({ alice: { joinedAt: '2026-10-15' } }),
  };
  return { module, state };
}

test('a game that declares no custom games cannot create one', () => {
  const { module, state } = raceRoom(['matchmaking', 'history']);
  const result = module.handle(
    state,
    {
      id: 'choice-0',
      ts: 0,
      payload: ChangeCustomGame({
        gameId: null,
        revision: 0,
        operation: 'create',
      } as Parameters<typeof ChangeCustomGame>[0]),
    },
    'alice'
  );
  expect(result.ok).toBe(false);
  expect(CustomGamesAttr.from(state).current).toBeNull();
});

// regression: game-session-action-length-coupling
test('an unrelated game uses the same configuration, bot turns, completion and replay contracts', () => {
  const room = raceRoom(['custom-games']);
  const module = room.module;
  let state = room.state;
  let sequence = 0;
  const change = (input: Record<string, unknown>, accepted = true) => {
    const game = CustomGamesAttr.from(state).current;
    const result = module.handle(
      state,
      {
        id: `choice-${sequence++}`,
        ts: 0,
        payload: ChangeCustomGame({
          gameId: game?.id ?? null,
          revision: game?.revision ?? 0,
          ...input,
        } as Parameters<typeof ChangeCustomGame>[0]),
      },
      'alice'
    );
    expect(result.ok).toBe(accepted);
    if (result.ok)
      for (const event of result.events) state = module.reduce(state, event);
  };
  change({ operation: 'create' });
  change({ operation: 'bot', side: 'white' });
  change({ operation: 'bot', side: 'black' });
  // regression: game-session-cosmetic-difficulty
  const beforeDifficulty = CustomGamesAttr.from(state).current;
  change({ operation: 'difficulty', side: 'white', difficulty: 'hard' }, false);
  expect(CustomGamesAttr.from(state).current).toEqual(beforeDifficulty);
  change({ operation: 'start' });
  for (let ply = 0; ply < 4; ply++) {
    const game = CustomGamesAttr.from(state).current!;
    const result = module.handle(
      state,
      {
        id: `bot-${ply}`,
        ts: ply * 1000,
        payload: PlayCustomGameBot({ gameId: game.id, side: game.turn, ply }),
      },
      ROOM_SCHEDULER_IDENTITY
    );
    expect(result.ok).toBe(true);
    if (result.ok)
      for (const event of result.events) state = module.reduce(state, event);
  }
  const game = CustomGamesAttr.from(state).current!;
  expect(game.fen).toBe('race:4');
  expect(game.status).toBe('completed');
  expect(game.outcome).toBe('black wins by finish line');
  expect(game.moves.map((move) => move.uci)).toEqual(
    Array(4).fill('advance-token')
  );
  change({ operation: 'rematch' });
  expect(CustomGamesAttr.from(state).current?.fen).toBe('race:0');
  expect(CustomGamesAttr.from(state).history).toEqual([game]);
});
