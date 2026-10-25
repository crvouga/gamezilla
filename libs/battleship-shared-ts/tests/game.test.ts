import { describe, expect, test } from 'bun:test';
import { battleshipAutomation } from '@libs/battleship-shared-ts/battleship-automation';
import { CELLS, cellLabel } from '@libs/battleship-shared-ts/battleship-board';
import { chooseBattleshipShot } from '@libs/battleship-shared-ts/battleship-bot';
import { battleshipGameShared } from '@libs/battleship-shared-ts/battleship-game';
import { battleshipNoticeText } from '@libs/battleship-shared-ts/battleship-notice-text';
import { battleshipRecord } from '@libs/battleship-shared-ts/battleship-record';
import type { GameRecordMetadata } from '@pkgs/turn-game-shared-ts/game-rules';
import { rules } from './battleship-oracle';

const METADATA: GameRecordMetadata = {
  participants: [
    { name: 'Ada', rating: '1500' },
    { name: 'Grace', rating: null },
  ],
  outcome: 'white',
  reason: 'fleet sunk',
  timeControl: null,
};

describe('the Battleship registration', () => {
  test('offers custom games, matchmaking and history, and no puzzles', () => {
    expect(battleshipGameShared.id).toBe('battleship');
    expect(Object.keys(battleshipGameShared.capabilities).sort()).toEqual([
      'custom-games',
      'history',
      'matchmaking',
    ]);
    expect(battleshipGameShared.capabilities.matchmaking.namespace).toBe(
      'battleship/'
    );
    expect(battleshipGameShared.turnGame.rules.setup).toBeDefined();
  });
  test('the notice names the fleets and the ending', () => {
    expect(battleshipNoticeText.side('white')).toBe('Blue fleet');
    expect(battleshipNoticeText.side('black')).toBe('Red fleet');
    expect(battleshipNoticeText.ending('fleet sunk')).toBe(
      'Sank the whole fleet.'
    );
    expect(battleshipNoticeText.ending('four in a row')).toBeUndefined();
    expect(battleshipNoticeText.timeoutDraw('black')).toBe(
      'Red fleet ran out of time, but the other side cannot win.'
    );
  });
  test('the record lists the public shots and never a fleet', () => {
    const position = rules.replay(['c2:hit', 'a1:hit', 'c3:sunk:destroyer'], 3);
    const record = JSON.parse(battleshipRecord(position, '', METADATA));
    expect(record).toEqual({
      game: 'battleship',
      ruleset: 'classic-10x10-v1',
      metadata: METADATA,
      position,
      shots: ['C2 hit', 'A1 hit', 'C3 sinks the destroyer'],
    });
    expect(JSON.stringify(record)).not.toContain('fleet:');
    expect(cellLabel('j10')).toBe('J10');
    expect(CELLS).toHaveLength(100);
  });
});

describe('Battleship automation', () => {
  test('chooses as the medium bot does', () => {
    const position = rules.replay(['e5:hit', 'a1:miss'], 2);
    for (const draw of [0, 0.4, 0.9])
      expect(battleshipAutomation.choose(position, () => draw, null)).toBe(
        chooseBattleshipShot(position, 'medium', () => draw)
      );
  });
  test('waits for the target cell to be enabled, then activates it', async () => {
    const calls: string[] = [];
    const ui = {
      get: (id: string) => ({
        wait: async (state: string) => {
          calls.push(`${id} wait ${state}`);
        },
        key: async (key: string) => {
          calls.push(`${id} key ${key}`);
        },
      }),
    } as unknown as Parameters<typeof battleshipAutomation.perform>[0];
    await battleshipAutomation.perform(ui, 'board', 'e5');
    expect(calls).toEqual([
      'board-target-e5 wait enabled',
      'board-target-e5 key enter',
    ]);
    await expect(
      battleshipAutomation.perform(ui, 'board', 'e5:hit')
    ).rejects.toThrow();
  });
});
