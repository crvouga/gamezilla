import { addClient, type ScriptRoomOpts, scriptRoom } from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';

export async function bootCounter(
  ids: readonly string[],
  opts?: ScriptRoomOpts
) {
  const run = await scriptRoom(counterSystem, opts);
  for (const id of ids) {
    await run.apply(addClient, { id });
  }
  await expectConverged(run);
  return run;
}
