/**
 * Explore walk: tap / fill / back / scroll plus product partition.
 */

import { describe } from '@pkgs/ui-testing';
import { back, fill, scroll, tap } from '@pkgs/ui-testing/explore';

import { actor, partition, spawnActor } from '../scenario';
import { openSim } from '../setup/open-sim';

describe('product walk', (ctx) => {
  ctx.test('walk tap/fill/back/scroll + partition', async () => {
    await using s = await openSim('product-walk', ctx);
    await s.apply(spawnActor, 'alice');
    const actorA = actor('alice');
    const w = await s.walk({
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
