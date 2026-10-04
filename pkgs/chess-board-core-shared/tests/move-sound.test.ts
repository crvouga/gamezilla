import { describe, expect, test } from 'bun:test';
import type { ChessMoveSoundPlayer } from '@pkgs/chess-board-core-shared/move-sound';
import {
  CHECK_AFTER_PRIMARY_MS,
  createMoveSoundScheduler,
  GAME_END_AFTER_CHECK_MS,
  PROMOTE_AFTER_CAPTURE_MS,
  planMoveSounds,
} from '@pkgs/chess-board-core-shared/move-sound';
import type { Move } from '@pkgs/chess-board-core-shared/types';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';

const QUIET: Move = { from: 'e2', to: 'e4' };
const CAPTURE: Move = { from: 'e4', to: 'd5', captured: 'p' };
const CASTLE: Move = {
  from: 'e1',
  to: 'g1',
  castle: { rookFrom: 'h1', rookTo: 'f1' },
};
const PROMO: Move = { from: 'e7', to: 'e8', promotion: 'q' };
const PROMO_CAPTURE: Move = {
  from: 'e7',
  to: 'd8',
  promotion: 'q',
  captured: 'r',
};
const NONE = { inCheck: false, isGameOver: false };

describe('planMoveSounds', () => {
  test('quiet move, castle, and promotion fire immediately', () => {
    expect(
      planMoveSounds({ move: QUIET, post: NONE, captureDelayMs: 200 })
    ).toEqual([{ atMs: 0, sound: 'playMove' }]);
    expect(
      planMoveSounds({ move: CASTLE, post: NONE, captureDelayMs: 200 })
    ).toEqual([{ atMs: 0, sound: 'playCastle' }]);
    expect(
      planMoveSounds({ move: PROMO, post: NONE, captureDelayMs: 200 })
    ).toEqual([{ atMs: 0, sound: 'playPromote' }]);
  });

  test('capture waits for the slide when animations are on', () => {
    expect(
      planMoveSounds({ move: CAPTURE, post: NONE, captureDelayMs: 200 })
    ).toEqual([{ atMs: 200, sound: 'playCapture' }]);
    expect(
      planMoveSounds({ move: CAPTURE, post: NONE, captureDelayMs: 0 })
    ).toEqual([{ atMs: 0, sound: 'playCapture' }]);
  });

  test('capture + promotion never share a tick', () => {
    expect(
      planMoveSounds({ move: PROMO_CAPTURE, post: NONE, captureDelayMs: 200 })
    ).toEqual([
      { atMs: 200, sound: 'playCapture' },
      { atMs: 200 + PROMOTE_AFTER_CAPTURE_MS, sound: 'playPromote' },
    ]);
  });

  test('check and game end trail the last primary sound', () => {
    expect(
      planMoveSounds({
        move: CAPTURE,
        post: { inCheck: true, isGameOver: true },
        captureDelayMs: 200,
      })
    ).toEqual([
      { atMs: 200, sound: 'playCapture' },
      { atMs: 200 + CHECK_AFTER_PRIMARY_MS, sound: 'playCheck' },
      {
        atMs: 200 + CHECK_AFTER_PRIMARY_MS + GAME_END_AFTER_CHECK_MS,
        sound: 'playGameEnd',
      },
    ]);
  });

  test('game end without check skips the check gap', () => {
    expect(
      planMoveSounds({
        move: QUIET,
        post: { inCheck: false, isGameOver: true },
        captureDelayMs: 0,
      })
    ).toEqual([
      { atMs: 0, sound: 'playMove' },
      { atMs: CHECK_AFTER_PRIMARY_MS, sound: 'playGameEnd' },
    ]);
  });
});

function recordingPlayer(): { player: ChessMoveSoundPlayer; log: string[] } {
  const log: string[] = [];
  const player: ChessMoveSoundPlayer = {
    playMove: () => log.push('move'),
    playCapture: () => log.push('capture'),
    playCheck: () => log.push('check'),
    playCastle: () => log.push('castle'),
    playPromote: () => log.push('promote'),
    playIllegal: () => log.push('illegal'),
    playGameEnd: () => log.push('gameEnd'),
  };
  return { player, log };
}

describe('createMoveSoundScheduler', () => {
  test('plays the plan on the injected timers', () => {
    const { clock, timers } = createHarnessClock();
    const { player, log } = recordingPlayer();
    const scheduler = createMoveSoundScheduler(player, timers);

    scheduler.apply(
      CAPTURE,
      { inCheck: true, isGameOver: false },
      { captureDelayMs: 200 }
    );
    expect(log).toEqual([]);
    clock.advance(200);
    expect(log).toEqual(['capture']);
    clock.advance(CHECK_AFTER_PRIMARY_MS);
    expect(log).toEqual(['capture', 'check']);
  });

  test('a new ply cancels pending follow-ups from the previous one', () => {
    const { clock, timers } = createHarnessClock();
    const { player, log } = recordingPlayer();
    const scheduler = createMoveSoundScheduler(player, timers);

    scheduler.apply(
      QUIET,
      { inCheck: true, isGameOver: false },
      { captureDelayMs: 0 }
    );
    expect(log).toEqual(['move']);
    scheduler.apply(QUIET, NONE, { captureDelayMs: 0 });
    clock.advance(1000);
    expect(log).toEqual(['move', 'move']);
  });

  test('dispose drops everything still pending', () => {
    const { clock, timers } = createHarnessClock();
    const { player, log } = recordingPlayer();
    const scheduler = createMoveSoundScheduler(player, timers);

    scheduler.apply(CAPTURE, NONE, { captureDelayMs: 200 });
    scheduler.dispose();
    clock.advance(1000);
    expect(log).toEqual([]);
  });
});
