import { addClient } from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { type OpenRoomOpts, openRoom } from './open-room';

export type { OpenRoomOpts };
export { openRoom };

export async function bootCounter(ids: readonly string[], opts?: OpenRoomOpts) {
  const s = await openRoom(counterSystem, opts);
  for (const id of ids) {
    await s.apply(addClient, { id });
  }
  await expectConverged(s);
  return s;
}
