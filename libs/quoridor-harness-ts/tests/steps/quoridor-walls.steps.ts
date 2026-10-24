import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import {
  placeQuoridorWall,
  quoridorWallEdges,
} from '@libs/quoridor-harness-ts/quoridor-actions';
import { setupQuoridor, viewQuoridor } from './quoridor-world';

Given('{actor} has a Classic Quoridor game with a horizontal wall at b4', (w) =>
  setupQuoridor(w, { moves: ['b4h', 'e8'] })
);
Given('{actor} has a Classic Quoridor game with a horizontal wall at d4', (w) =>
  setupQuoridor(w, { moves: ['d4h', 'e8'] })
);
Given(
  "{actor} has a Classic Quoridor position where a vertical wall at e8 would close North's last path",
  (w) => setupQuoridor(w, { fixture: 'north-cage' })
);
Given(
  "{actor} has a Classic Quoridor position where a vertical wall at e1 would close South's last path",
  (w) => setupQuoridor(w, { fixture: 'south-cage' })
);
Given(
  "{actor} has a hill mode Quoridor position where a vertical wall at e4 would close East's last path to the hill",
  (w) => setupQuoridor(w, { mode: 'hill', fixture: 'hill-cage' })
);
Given('{actor} has a Classic Quoridor game with one remaining wall', (w) =>
  setupQuoridor(w, { fixture: 'last-wall' })
);
Given('{actor} has a Classic Quoridor game with no remaining walls', (w) =>
  setupQuoridor(w, { fixture: 'no-walls' })
);

When(
  '{actor} places a {word} Quoridor wall at {word}',
  (w, actor: string, direction: string, cell: string) =>
    w.s.apply(placeQuoridorWall, actor, { orientation: direction, cell })
);
When(
  '{actor} places a {word} Quoridor wall at {word} using the keyboard',
  (w, actor: string, direction: string, cell: string) =>
    w.s.apply(placeQuoridorWall, actor, {
      orientation: direction,
      cell,
      keyboard: true,
    })
);

Then('the Quoridor wall blocks d4 to d5 and e4 to e5', async (w) => {
  expect((await w.s.read(quoridorWallEdges, 'd4')).top).toBe('true');
  expect((await w.s.read(quoridorWallEdges, 'e4')).top).toBe('true');
});
Then(
  'the vertical Quoridor wall separates columns d and e on rows 4 and 5',
  async (w) => {
    expect((await w.s.read(quoridorWallEdges, 'd4')).right).toBe('true');
    expect((await w.s.read(quoridorWallEdges, 'd5')).right).toBe('true');
  }
);
Then(
  'South has nine remaining walls and North has the Quoridor turn',
  async (w) => {
    const view = await viewQuoridor(w);
    expect(view.game.remaining[0]).toBe(9);
    expect(view.current?.turn).toBe('black');
  }
);
Then(
  'South has no remaining walls and North has the Quoridor turn',
  async (w) => {
    const view = await viewQuoridor(w);
    expect(view.game.remaining[0]).toBe(0);
    expect(view.current?.turn).toBe('black');
  }
);
Then('both Quoridor walls are on the board', async (w) =>
  expect((await viewQuoridor(w)).game.walls).toEqual(['b4h', 'd4h'])
);
Then("one of South's remaining walls is spent", async (w) =>
  expect((await viewQuoridor(w)).game.remaining[0]).toBe(8)
);
Then(
  'the Quoridor wall is on the board and every player has a path to the opposite home row',
  async (w) => expect((await viewQuoridor(w)).game.walls).toEqual(['d8h'])
);
Then(
  '{actor} is told the Quoridor wall would extend beyond the board',
  async (w, actor: string) =>
    expect((await viewQuoridor(w, actor)).wallStatus).toContain(
      'Walls must fit'
    )
);
Then(
  '{actor} is told the Quoridor wall overlaps another wall',
  async (w, actor: string) =>
    expect((await viewQuoridor(w, actor)).wallStatus).toContain('overlaps')
);
Then(
  '{actor} is told the Quoridor wall crosses another wall',
  async (w, actor: string) =>
    expect((await viewQuoridor(w, actor)).wallStatus).toContain('crosses')
);
Then(
  "{actor} is told the Quoridor wall would block a player's last path to the goal",
  async (w, actor: string) =>
    expect((await viewQuoridor(w, actor)).wallStatus).toContain('last path')
);
Then(
  '{actor} is told South has no remaining Quoridor walls',
  async (w, actor: string) =>
    expect((await viewQuoridor(w, actor)).wallStatus).toContain('no walls left')
);
