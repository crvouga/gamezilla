import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import {
  preferQuoridorReducedMotion,
  type QuoridorSetup,
} from '@libs/quoridor-harness-ts/quoridor-actions';
import {
  QUORIDOR_HILL_PLAYABLE,
  QUORIDOR_PLAYABLE,
} from '@libs/quoridor-harness-ts/quoridor-playable';
import { setupQuoridor, viewQuoridor } from './quoridor-world';

Given('{actor} has chosen Classic Quoridor', (w) => {
  w.memo.set('quoridor-mode', 'classic');
});
Given('{actor} has chosen Four-Player King of the Hill', (w) => {
  w.memo.set('quoridor-mode', 'hill');
});
When('{actor} creates a Quoridor custom game', (w) =>
  setupQuoridor(w, {
    mode: w.memo.get('quoridor-mode') as NonNullable<QuoridorSetup['mode']>,
  })
);
Given('{actor} has a Classic Quoridor game South has won', (w) =>
  setupQuoridor(w, { moves: QUORIDOR_PLAYABLE.fixtures.firstSideVictory })
);
Given('{actor} has a Four-Player King of the Hill game South has won', (w) =>
  setupQuoridor(w, {
    mode: 'hill',
    moves: QUORIDOR_HILL_PLAYABLE.fixtures.firstSideVictory,
  })
);

Then('the Quoridor board has nine columns and nine rows', async (w) =>
  expect((await viewQuoridor(w)).boardLabel).toBe(
    'Quoridor board, nine columns and nine rows'
  )
);
Then(
  'South begins on e1 and North begins on e9 with ten walls each',
  async (w) => {
    const view = await viewQuoridor(w);
    expect(view.game.pawns).toEqual([4, 76]);
    expect(view.game.remaining).toEqual([10, 10]);
  }
);
Then(
  'South has the Quoridor turn and each goal is the opposite home row',
  async (w) => {
    expect((await viewQuoridor(w)).current?.turn).toBe('white');
    expect((await viewQuoridor(w)).game.mode).toBe('classic');
  }
);
Then(
  'South begins on e1, West on a5, North on e9 and East on i5 with five walls each',
  async (w) => {
    const view = await viewQuoridor(w);
    expect(view.game.pawns).toEqual([4, 36, 76, 44]);
    expect(view.game.remaining).toEqual([5, 5, 5, 5]);
  }
);
Then('the Quoridor turn order is South, West, North, East', async (w) =>
  expect((await viewQuoridor(w)).current?.sides).toEqual([
    'white',
    'black',
    'red',
    'blue',
  ])
);
Then(
  'the Quoridor hill is the single square e5 and first arrival wins',
  async (w) => expect((await viewQuoridor(w)).game.mode).toBe('hill')
);
Then('South wins Classic Quoridor immediately', async (w) =>
  expect((await viewQuoridor(w)).current?.outcome).toBe(
    'white wins by opposite row reached'
  )
);
Then('South wins Four-Player King of the Hill immediately', async (w) =>
  expect((await viewQuoridor(w)).current?.outcome).toBe(
    'white wins by hill reached'
  )
);
Then("the Quoridor game continues with North's turn", async (w) => {
  const view = await viewQuoridor(w);
  expect(view.current?.status).toBe('active');
  expect(view.current?.turn).toBe('black');
});
Then("the Quoridor game continues with West's turn", async (w) => {
  const view = await viewQuoridor(w);
  expect(view.current?.status).toBe('active');
  expect(view.current?.turn).toBe('black');
});
Then('no other Quoridor player takes a turn', async (w) =>
  expect((await viewQuoridor(w)).current?.status).toBe('completed')
);
Then(
  '{actor} is told the Quoridor game is finished',
  async (w, actor: string) =>
    expect((await viewQuoridor(w, actor)).error).toBe('finished')
);

Given(
  '{actor} has a new King of the Hill game with reduced motion',
  async (w, actor: string) => {
    await setupQuoridor(w, { mode: 'hill' });
    await w.s.apply(preferQuoridorReducedMotion, actor);
  }
);
Given(
  "{actor} is watching Alice's new Classic Quoridor game",
  (w, actor: string) => setupQuoridor(w, { watchers: [actor] })
);
Then(
  "the Quoridor board identifies South's circle, West's diamond, North's triangle and East's square",
  async (w) => {
    const view = await viewQuoridor(w);
    expect(view.pawnLabels).toEqual([
      expect.stringContaining('South red circle'),
      expect.stringContaining('West gold diamond'),
      expect.stringContaining('North green triangle'),
      expect.stringContaining('East black square'),
    ]);
  }
);
Then(
  'the Quoridor wall preview explains that it crosses another wall',
  async (w) => expect((await viewQuoridor(w)).wallStatus).toContain('crosses')
);
Then('{actor} is told she is not a Quoridor player', async (w, actor: string) =>
  expect((await viewQuoridor(w, actor)).error).toBe(
    'only the participant to move may play'
  )
);
