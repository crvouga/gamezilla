/**
 * Explore walk: tap / fill / back / scroll plus product partition.
 */

import { describe, expect, test } from 'bun:test';
import { back, fill, scroll, tap } from '@pkgs/ui-testing/explore';
import { actor, partition, spawnActor } from '../src/sim';
import { openSim } from '../src/test/setup/open-sim';

describe('product walk', () => {
  test('walk tap/fill/back/scroll + partition', async () => {
    await using s = await openSim('product-walk');
    await s.apply(spawnActor, 'alice');
    const actorA = actor('alice');
    const w = await s.randomActions({
      actions: [
        tap(actorA),
        fill(actorA),
        back(actorA),
        scroll(actorA),
        partition,
      ],
      steps: 40,
    });
    expect(w.violations).toEqual([]);
  });
});
