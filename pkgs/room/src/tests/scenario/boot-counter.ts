import {
  addClient,
  converge,
  type StartRoomOpts,
  startRoom,
} from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';

export async function bootCounter(
  ids: readonly string[],
  opts?: StartRoomOpts
) {
  const run = await startRoom(counterSystem, opts);
  for (const id of ids) {
    await run.apply(addClient, { id });
  }
  await run.apply(converge);
  return run;
}
