/**
 * Explore walk: tap / fill / back / scroll plus product partition.
 */

import { describe } from '@pkgs/ui-testing';
import { back, fill, scroll, tap } from '@pkgs/ui-testing/explore';
import { openSim } from '../src/setup/open-sim';
import { actor, partition, spawnActor } from '../src/sim';

describe('product walk', (ctx) => {
  ctx.test('walk tap/fill/back/scroll + partition', async () => {
    await using s = await openSim('product-walk', ctx);
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
