import { expect, test } from 'bun:test';
import { nightlyGameSpecTurn } from './nightly-game-spec-turn';

// regression: nightly-cold-game-spec-capacity
test('four consecutive UTC dates cover all 161 cold game partitions once', () => {
  const dates = ['2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'];
  const turns = dates.map((date) => nightlyGameSpecTurn(date + 'T23:59:59Z'));
  for (let partition = 0; partition < 161; partition++) {
    const task = `@libs/games-harness-ts#test:spec:${partition}`;
    expect(turns.filter((turn) => turn.includes(task))).toHaveLength(1);
  }
  for (const task of [
    '@libs/billing-harness-ts#test:spec:2',
    '@libs/games-harness-ts#test:contract:1',
  ])
    expect(turns.every((turn) => turn.includes(task))).toBe(true);
  expect(nightlyGameSpecTurn('2026-11-30T00:00:00Z').turn).toBe(
    nightlyGameSpecTurn('2026-11-26T00:00:00Z').turn
  );
});
