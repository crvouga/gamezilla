import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import { passQuoridorTurn } from '@libs/quoridor-harness-ts/quoridor-model';
import { setupQuoridor, viewQuoridor } from './quoridor-world';

Given(
  '{actor} has a King of the Hill game with South on e2, West on e3 and North on e4',
  (w) => setupQuoridor(w, { mode: 'hill', fixture: 'pass-corridor' })
);
Given(
  'South has no remaining walls and walls prevent a move towards column d, column f or row 1',
  async (w) => {
    const view = await viewQuoridor(w);
    expect(view.game.remaining[0]).toBe(0);
    expect(view.game.pawns).toEqual([13, 22, 31, 44]);
    expect(view.game.walls).toEqual(
      expect.arrayContaining(['d2v', 'e2v', 'd1h'])
    );
  }
);
When('{actor} passes her Quoridor turn', (w, actor: string) =>
  w.s.apply(passQuoridorTurn, actor)
);
Then('the Quoridor pawns and walls are unchanged', async (w) => {
  const before = w.memo.get('quoridor-before') as Awaited<
    ReturnType<typeof viewQuoridor>
  >;
  const now = await viewQuoridor(w);
  expect(now.game.pawns).toEqual(before.game.pawns);
  expect(now.game.walls).toEqual(before.game.walls);
  expect(now.game.remaining).toEqual(before.game.remaining);
});
