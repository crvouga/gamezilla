import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import { moveQuoridorPawn } from '@libs/quoridor-harness-ts/quoridor-actions';
import { setupQuoridor, viewQuoridor } from './quoridor-world';

Given('{actor} has a new Classic Quoridor game', (w) => setupQuoridor(w));
Given('{actor} and {actor} have a new Classic Quoridor game', (w) =>
  setupQuoridor(w)
);
Given(
  '{actor} has the Quoridor position with South on e3 and North on e8',
  (w) => setupQuoridor(w, { fixture: 'backward' })
);
Given(
  '{actor} has the Quoridor position with South on e2, North on e8 and a horizontal wall at d2',
  (w) => setupQuoridor(w, { fixture: 'step-wall' })
);
Given(
  '{actor} has the Quoridor position with South on e4 and North on e5',
  (w) => setupQuoridor(w, { fixture: 'face' })
);
Given(
  '{actor} has the Quoridor position with South on e4, North on e5 and a horizontal wall at d4',
  (w) => setupQuoridor(w, { fixture: 'jump-wall' })
);
Given(
  '{actor} has the Quoridor position with South on e4, North on e5 and a horizontal wall at d5',
  (w) => setupQuoridor(w, { fixture: 'diagonal-wall' })
);
Given(
  '{actor} has the Quoridor position with South on h5 and North on i5',
  (w) => setupQuoridor(w, { fixture: 'diagonal-edge' })
);
Given(
  '{actor} has the Quoridor position with South on e4, North on e5, a horizontal wall at d5 and a vertical wall at d4',
  (w) => setupQuoridor(w, { fixture: 'diagonal-sidewall' })
);
Given(
  '{actor} has the hill mode Quoridor position with South on d3, West on d4, North on d5 and East on i5',
  (w) => setupQuoridor(w, { mode: 'hill', fixture: 'triple' })
);
Given(
  '{actor} has the Quoridor position with South on d8 and North on e7',
  (w) => setupQuoridor(w, { fixture: 'classic-goal' })
);
Given(
  '{actor} has the Quoridor position with South on e4 and North on e8',
  (w) => setupQuoridor(w, { fixture: 'classic-center' })
);
Given(
  '{actor} has the hill mode Quoridor position with South on e4, West on a5, North on e9 and East on i5',
  (w) => setupQuoridor(w, { mode: 'hill', fixture: 'hill-goal' })
);
Given(
  '{actor} has the hill mode Quoridor position with South on d8, West on a5, North on e9 and East on i5',
  (w) => setupQuoridor(w, { mode: 'hill', fixture: 'hill-wronggoal' })
);
Given(
  '{actor} has the hill mode Quoridor position with South on e3, West on a5, North on e9 and East on i5',
  (w) => setupQuoridor(w, { mode: 'hill', fixture: 'hill-continue' })
);
Given(
  '{actor}, {actor}, {actor} and {actor} have a King of the Hill game after each of the first three players has moved',
  (w) => setupQuoridor(w, { mode: 'hill', moves: ['e2', 'a4', 'e8'] })
);

When(
  '{actor} moves her/his Quoridor pawn to {word}',
  (w, actor: string, square: string) =>
    w.s.apply(moveQuoridorPawn, actor, square)
);
When(
  '{actor} moves her/his Quoridor pawn to {word} using the keyboard',
  (w, actor: string, square: string) =>
    w.s.apply(moveQuoridorPawn, actor, square, true)
);

Then("South's Quoridor pawn is on {word}", async (w, square: string) => {
  expect((await viewQuoridor(w)).pawnLabels[0]).toContain(square);
});
Then("East's Quoridor pawn is on {word}", async (w, square: string) => {
  expect((await viewQuoridor(w)).pawnLabels[3]).toContain(square);
});
Then('North has the Quoridor turn', async (w) =>
  expect((await viewQuoridor(w)).current?.turn).toBe('black')
);
Then('West has the Quoridor turn', async (w) =>
  expect((await viewQuoridor(w)).current?.turn).toBe('black')
);
Then('South has the Quoridor turn', async (w) =>
  expect((await viewQuoridor(w)).current?.turn).toBe('white')
);
Then(
  '{actor} is told the Quoridor pawn move is not allowed',
  async (w, actor: string) =>
    expect((await viewQuoridor(w, actor)).error).toBe('move is illegal')
);
Then("{actor} is told it is South's Quoridor turn", async (w, actor: string) =>
  expect((await viewQuoridor(w, actor)).error).toBe(
    'only the participant to move may play'
  )
);
Then(
  'the Quoridor board, remaining walls and turn are unchanged',
  async (w) => {
    const before = w.memo.get('quoridor-before') as Awaited<
      ReturnType<typeof viewQuoridor>
    >;
    const now = await viewQuoridor(w);
    expect(now.current).toEqual(before.current);
    expect(now.game).toEqual(before.game);
  }
);
