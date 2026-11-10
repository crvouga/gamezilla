import { expect, test } from 'bun:test';
import { ownSokobanDraft } from '@libs/sokoban-harness-ts/sokoban-building';
import { playtestSokobanDraft } from '@libs/sokoban-harness-ts/sokoban-proof';
import { screensOf } from '@libs/sokoban-harness-ts/sokoban-screen';
import { sokobanSystem } from '@libs/sokoban-harness-ts/sokoban-system';

// regression: sokoban-playtest-withheld-harness-waits
test('a playtest the builder withholds is refused, not awaited', async () => {
  await using run = await sokobanSystem.run({ seed: 'cb88294e5aedae41' });
  await run.apply(ownSokobanDraft, 'Corner', [
    ['', 'A', 'B', 'C'],
    ['1', 'floor', 'crate', 'goal'],
  ]);
  await run.apply(playtestSokobanDraft);
  expect(await run.read((s) => screensOf(s, 'alice:phone').play)).toBeNull();
});
