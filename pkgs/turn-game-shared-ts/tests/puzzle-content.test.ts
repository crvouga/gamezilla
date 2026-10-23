import { expect, test } from 'bun:test';
import { assertPuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';
import { warehousePuzzleContent as content } from './warehouse-puzzle';

test('opaque state capabilities support pushing puzzles without a line, solver, turns or grid contract', () => {
  expect(() => assertPuzzleContent('warehouse', content)).not.toThrow();
  const initial = content.rules.initial('corridor');
  expect(initial).toEqual({ accepted: true, state: '0,1' });
  if (!initial.accepted) throw new Error('corridor refused');
  const first = content.rules.apply('corridor', initial.state, 'right');
  expect(first).toEqual({ accepted: true, state: '1,2' });
  if (!first.accepted) throw new Error('push refused');
  const second = content.rules.apply('corridor', first.state, 'right');
  expect(second).toEqual({ accepted: true, state: '2,3' });
  if (!second.accepted) throw new Error('push refused');
  expect(content.rules.complete('corridor', second.state)).toBe(true);
  expect(content.rules.validateState('corridor', second.state)).toEqual({
    valid: true,
  });
  expect(content.rules.apply('corridor', initial.state, 'left')).toMatchObject({
    accepted: false,
  });
  expect(content.rules.complete('corridor', initial.state)).toBe(false);
  expect(content.rules.validateState('corridor', '1,1')).toMatchObject({
    valid: false,
  });
  expect(content.statistics?.('corridor', second.state)).toEqual({
    boxOnGoal: true,
  });
  expect(content.solver).toBeUndefined();
  expect(content.validatePublication).toBeUndefined();
});
