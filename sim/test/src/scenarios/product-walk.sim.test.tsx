/**
 * Explore walk: tap / fill / back / scroll plus product partition.
 */

import { walk } from '@pkgs/dst';
import { describe } from '@pkgs/ui-testing';
import { back, fill, scroll, tap } from '@pkgs/ui-testing/explore';

import { actor, randomPartition, spawnActor } from '../scenario';
import { openSim } from '../setup/open-sim';

describe('product walk', (ctx) => {
  ctx.test(
    'walk tap/fill/back/scroll + partition',
    async () => {
      await using run = await openSim('product-walk', ctx);
      await run.apply(spawnActor, 'alice');
      const actorA = actor('alice');
      const w = await walk(run, {
        actions: [
          tap(actorA),
          fill(actorA),
          back(actorA),
          scroll(actorA),
          randomPartition,
        ],
        steps: 40,
      });
      expect(w.violations).toEqual([]);
    },
    60_000
  );
});
