import { expect, test } from 'bun:test';
import { quoridorToolSuffix } from '@libs/quoridor-harness-ts/quoridor-actions';

// regression: quoridor-completed-board-observation
test('a board remains observable after its tool buttons disappear', async () => {
  for (const suffix of ['', 'h', 'v']) {
    const visibleCell = `custom-game-board-action-a1${suffix}`;
    const actual = await quoridorToolSuffix(async (id) => {
      if (id.includes('-mode-'))
        throw new Error('Completed games have no tool action bar');
      return id === visibleCell;
    });
    expect(actual).toBe(suffix);
  }
});
