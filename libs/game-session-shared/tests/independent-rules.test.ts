import { expect, test } from 'bun:test';
import {
  ChangeCustomGame,
  PlayCustomGameBot,
} from '@libs/game-session-shared/custom-game-commands';
import { CustomGamesAttr } from '@libs/game-session-shared/custom-game-state';
import { defineTurnGame } from '@libs/game-session-shared/turn-game-definition';
import { GamesRoomAttr } from '@libs/spaces-shared/games';
import { SpaceMembersRoomAttr } from '@libs/spaces-shared/space-members-messages';
import { createSpaceModule } from '@libs/spaces-shared/space-module';
import { ROOM_SCHEDULER_IDENTITY } from '@pkgs/room-root-shared/builtin';
import { assertRoomModuleName } from '@pkgs/room-root-shared/types';
import type {
  GameRules,
  TurnGameCapabilities,
} from '@pkgs/turn-game-shared/game-rules';
import { bots, notice, rules } from './reference-game';

function raceRoom(capabilities: TurnGameCapabilities, gameRules = rules) {
  const definition = defineTurnGame({
    rules: gameRules,
    capabilities,
    automation: { choose: () => null, perform: async () => {} },
  });
  const module = createSpaceModule(
    assertRoomModuleName('race-room'),
    [definition],
    () => 0,
    () => 0
  );
  const state = {
    ...module.initialState(),
    ...GamesRoomAttr.selected(gameRules.id),
    ...SpaceMembersRoomAttr.seats({ alice: { joinedAt: '2026-10-15' } }),
  };
  return { module, state };
}

test('a game that declares no custom games cannot create one', () => {
  const { module, state } = raceRoom({
    matchmaking: { clockNamespace: 'counting-race/', notice },
    history: { record: String },
  });
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
  const room = raceRoom({ 'custom-games': { bots } });
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

/**
 * The rules name the winner (`PlayedPosition.winner`), and a move may lose
 * for the side that made it: in this misère race, counting to four loses.
 * Matched games and puzzles already credited the rules' winner; custom
 * games credited the mover.
 */
test('a custom game credits the side the rules name as winner, not the mover', () => {
  // regression: custom-game-mover-credited-win
  const misere: GameRules = {
    ...rules,
    play(position, action, history, actions) {
      const played = rules.play(position, action, history, actions);
      return played?.winner === 'black'
        ? { ...played, winner: 'white', reason: 'black counted to four' }
        : played;
    },
  };
  const room = raceRoom({ 'custom-games': { bots } }, misere);
  let state = room.state;
  let sequence = 0;
  const change = (input: Record<string, unknown>) => {
    const game = CustomGamesAttr.from(state).current;
    const result = room.module.handle(
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
    expect(result.ok).toBe(true);
    if (result.ok)
      for (const event of result.events)
        state = room.module.reduce(state, event);
  };
  change({ operation: 'create' });
  change({ operation: 'bot', side: 'white' });
  change({ operation: 'bot', side: 'black' });
  change({ operation: 'start' });
  for (let ply = 0; ply < 4; ply++) {
    const game = CustomGamesAttr.from(state).current!;
    const result = room.module.handle(
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
      for (const event of result.events)
        state = room.module.reduce(state, event);
  }
  const game = CustomGamesAttr.from(state).current!;
  expect(game.status).toBe('completed');
  // Black made the last count, and lost by it.
  expect(game.outcome).toBe('white wins by black counted to four');
});

/**
 * Game history lists each finished game once (`useGameRecords` lists the
 * room's history beside matched games without merging by id). A finished
 * game leaves `current` for the history in the one transition that
 * replaces it; a repeated or competing request for a new game finds the
 * new one in place and is refused, so nothing is appended twice.
 */
test('a finished game enters the history once, however often a new game is asked for', () => {
  const room = raceRoom({ 'custom-games': { bots } });
  const module = room.module;
  let state = room.state;
  const send = (id: string, input: Record<string, unknown>, ts = 0) => {
    const game = CustomGamesAttr.from(state).current;
    const result = module.handle(
      state,
      {
        id,
        ts,
        payload: ChangeCustomGame({
          gameId: game?.id ?? null,
          revision: game?.revision ?? 0,
          ...input,
        } as Parameters<typeof ChangeCustomGame>[0]),
      },
      'alice'
    );
    if (result.ok)
      for (const event of result.events) state = module.reduce(state, event);
    return result.ok;
  };
  expect(send('create-1', { operation: 'create' })).toBe(true);
  expect(send('cancel-1', { operation: 'cancel' })).toBe(true);
  const first = CustomGamesAttr.from(state).current!;
  expect(first.status).toBe('cancelled');

  expect(send('rematch-1', { operation: 'rematch' })).toBe(true);
  // The same request again, and a competing one, both find the new game.
  expect(send('rematch-1', { operation: 'rematch' })).toBe(false);
  expect(send('create-2', { operation: 'create' })).toBe(false);
  expect(CustomGamesAttr.from(state).history.map((g) => g.id)).toEqual([
    first.id,
  ]);

  expect(send('cancel-2', { operation: 'cancel' })).toBe(true);
  const second = CustomGamesAttr.from(state).current!;
  expect(send('create-3', { operation: 'create' })).toBe(true);
  const history = CustomGamesAttr.from(state).history.map((g) => g.id);
  expect(history).toEqual([first.id, second.id]);
  expect(new Set(history).size).toBe(history.length);
});
