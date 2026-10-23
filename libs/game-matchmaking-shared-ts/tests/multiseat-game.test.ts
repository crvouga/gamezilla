import { expect, test } from 'bun:test';
import { playMultiplayerMove } from '@libs/game-matchmaking-shared-ts/game';
import {
  acceptDraw,
  offerDraw,
  resignGame,
} from '@libs/game-matchmaking-shared-ts/game-decisions';
import { gameRecord } from '@libs/game-matchmaking-shared-ts/game-record';
import { bothHaveMoved } from '@libs/game-matchmaking-shared-ts/game-state';
import {
  clockLeftMs,
  multiplayerDeadlineMs,
  settleMultiplayerClock,
  sideToMove,
} from '@libs/game-matchmaking-shared-ts/multiplayer-clock';
import { multiplayerNotices } from '@libs/game-matchmaking-shared-ts/multiplayer-notices';
import { MULTISEAT_GAMES, multiseatGame } from './multiseat-fixture';

test('all declared participants own their turns and the third seat can win', () => {
  let game = multiseatGame();
  const people = ['alice', 'bob', 'carol', 'dave', 'alice', 'bob', 'carol'];
  for (const [ply, person] of people.entries()) {
    expect(game.turn).toBe(person);
    game = playMultiplayerMove(
      game,
      { actorId: person, revision: ply, uci: 'step', nowMs: ply * 1000 },
      MULTISEAT_GAMES
    );
    expect(bothHaveMoved(game)).toBe(ply >= 3);
  }
  expect(game).toMatchObject({ outcome: 'red', turn: '', revision: 7 });
  expect(() =>
    playMultiplayerMove(
      game,
      { actorId: 'dave', revision: 7, uci: 'step', nowMs: 7000 },
      MULTISEAT_GAMES
    )
  ).toThrow('over');
  const record = gameRecord(
    game,
    { white: 'Alice', black: 'Bob', red: 'Carol', blue: 'Dave' },
    MULTISEAT_GAMES
  );
  expect(
    (
      JSON.parse(record!) as { participants: { name: string }[] }
    ).participants.map((person: { name: string }) => person.name)
  ).toEqual(['Alice', 'Bob', 'Carol', 'Dave']);
});

test('rejected actions leave all four participants clocks and position untouched', () => {
  const game = multiseatGame({ revision: 2, turn: 'carol' });
  const before = JSON.stringify(game);
  for (const [actorId, revision, uci] of [
    ['alice', 2, 'step'],
    ['carol', 1, 'step'],
    ['carol', 2, 'illegal'],
  ] as const) {
    expect(() =>
      playMultiplayerMove(
        game,
        { actorId, revision, uci, nowMs: 1000 },
        MULTISEAT_GAMES
      )
    ).toThrow();
    expect(JSON.stringify(game)).toBe(before);
  }
});

test('a fourth participants clock owns its budget and expiry draws the round', () => {
  const game = multiseatGame({
    revision: 7,
    turn: 'dave',
    blue_ms: 5000,
    clock_at_ms: 1000,
  });
  expect(sideToMove(game)).toBe('blue');
  expect(clockLeftMs(game, 'blue', 4000)).toBe(2000);
  expect(clockLeftMs(game, 'red', 4000)).toBe(180000);
  expect(multiplayerDeadlineMs(game)).toBe(6000);
  expect(settleMultiplayerClock(game, 6000, MULTISEAT_GAMES)).toMatchObject({
    outcome: 'draw',
    reason: 'timeout',
    blue_ms: 0,
  });
});

test('a draw needs every participant once and withdrawal keeps a drawn record', () => {
  let game = offerDraw(multiseatGame({ revision: 4 }), 'alice');
  game = acceptDraw(game, 'carol');
  game = acceptDraw(game, 'carol');
  game = acceptDraw(game, 'bob');
  expect(game.outcome).toBe('ongoing');
  expect(acceptDraw(game, 'dave')).toMatchObject({
    outcome: 'draw',
    reason: 'agreement',
  });
  expect(resignGame(game, 'carol')).toMatchObject({
    outcome: 'draw',
    reason: 'participant withdrew',
  });
});

test('daily notices name every participant and identify third and fourth seat results', () => {
  const game = multiseatGame({
    time_control: 'four-seat-reference/1d',
    turn: '',
    outcome: 'blue',
  });
  expect(
    multiplayerNotices(game).map(({ userId, result, turn }) => ({
      userId,
      result,
      turn,
    }))
  ).toEqual([
    { userId: 'alice', result: 'lost', turn: false },
    { userId: 'bob', result: 'lost', turn: false },
    { userId: 'carol', result: 'lost', turn: false },
    { userId: 'dave', result: 'won', turn: false },
  ]);
});
