import { addClient, type RoomArgs } from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';

export type BootCounterOpts = {
  readonly seed?: number | bigint | string;
  readonly args?: Partial<RoomArgs>;
};

/** Counter script with named clients joined and converged. */
export async function bootCounter(
  ids: readonly string[],
  opts?: BootCounterOpts
) {
  const s = await counterSystem.script({
    seed: opts?.seed ?? 42,
    args: opts?.args ?? {},
  });
  for (const id of ids) {
    await s.apply(addClient, { id });
  }
  await expectConverged(s);
  return s;
}
