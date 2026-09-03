import { addClient, type StartRoomOpts, startRoom } from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';

export async function bootCounter(
  ids: readonly string[],
  opts?: StartRoomOpts
) {
  const run = await startRoom(counterSystem, opts);
  for (const id of ids) {
    await run.apply(addClient, { id });
  }
  await expectConverged(run);
  return run;
}
