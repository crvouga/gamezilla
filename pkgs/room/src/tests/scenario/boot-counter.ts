import { addClient } from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { openRoom, type OpenRoomOpts } from './open-room';

export type { OpenRoomOpts };
export { openRoom };

export async function bootCounter(
  ids: readonly string[],
  opts?: OpenRoomOpts
) {
  const run = await openRoom(counterSystem, opts);
  for (const id of ids) {
    await run.apply(addClient, { id });
  }
  await expectConverged(run);
  return run;
}
